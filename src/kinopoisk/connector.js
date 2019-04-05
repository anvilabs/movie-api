/* @flow */

import DataLoader from 'dataloader';
import moment from 'moment';
import PromiseThrottle from 'promise-throttle';
import R from 'ramda';
import rp from 'request-promise-native';

import {userAgent, applyQueryToUrl} from '../utils';

const KINOPOISK_API_ROOT = 'https://ext.kinopoisk.ru/ios/5.0.0';

const KINOPOISK_REQUEST_HEADERS_API_URL =
  'https://kinopoisk-headers.codobred.now.sh/';

type Endpoint =
  // Movie info
  | 'getGallery'
  | 'getStaffList'
  | 'getKPFilmDetailView'
  | 'getKPFilmsList'
  | 'getKPPeopleDetailView'
  // Genres
  | 'getKPGenresView'
  | 'getKPTopGenre'
  // Reviews
  | 'getKPReviews'
  | 'getKPReviewDetail'
  // News
  | 'getKPNewsView'
  | 'getKPNewsDetail'
  // Coming soon
  | 'getKPSoonFilms'
  | 'getKPSoonDVD'
  | 'getDatesForSoonFilms'
  | 'getDatesForSoonDVD'
  // Showtimes
  | 'getKPTodayFilms'
  | 'getKPCinemas'
  | 'getKPCinemaDetailView'
  | 'getSeance'
  | 'getDatesForDetailCinema'
  | 'getDatesForSeance'
  // Top
  | 'getKPTop'
  | 'getPopularIndex'
  // Search
  | 'getKPGlobalSearch'
  | 'getKPLiveSearch'
  | 'getKPSearchInCinemas'
  | 'getKPSearchInFilms'
  | 'getKPSearchInPeople'
  | 'navigator'
  | 'navigatorFilters'
  // Geo Reference
  | 'getKPCountryView'
  | 'getKPAllCitiesView';

type Rp = (options: Object) => Promise<any>;

class KinopoiskConnector {
  _apiRp: Rp = rp.defaults({
    headers: {
      'Image-Scale': '3',
      cityID: '1',
      countryID: '2',
      'User-Agent': 'Android client (4.4 / api19), ru.kinopoisk/4.2.0 (55)',
      device: 'android',
      'Android-Api-Version': '19',
      clientDate: moment(new Date()).format('HH:mm dd.MM.YYYY'),
    },
    timeout: 4000,
    json: true,
    gzip: true,
    jar: true,
  });

  _apiThrottleQueue = new PromiseThrottle({
    requestsPerSecond: 3,
    promiseImplementation: Promise,
  });

  _getApiRequestHeaders = async (apiRequestUrl: string) => {
    const response = await rp.head({
      url: KINOPOISK_REQUEST_HEADERS_API_URL,
      headers: {
        'X-Kinopoisk-Url': apiRequestUrl,
        'X-Server-ID': userAgent,
      },
      resolveWithFullResponse: true,
    });

    return {
      'X-SIGNATURE': response.headers['x-signature'],
      'X-TIMESTAMP': response.headers['x-timestamp'],
    };
  };

  apiLoader: DataLoader<string, any> = new DataLoader(
    (urls: Array<string>) =>
      this._apiThrottleQueue.addAll(
        urls.map((url: string) => async () => {
          const headers = await this._getApiRequestHeaders(url);

          return this._apiRp({
            uri: url,
            headers,
          });
        }),
      ),
    {
      batch: false,
    },
  );

  apiGet = async (endpoint: Endpoint, query: void | {[key: string]: mixed}) => {
    const json = await this.apiLoader.load(
      applyQueryToUrl(`${KINOPOISK_API_ROOT}/${endpoint}`, query),
    );

    return R.prop('data')(json);
  };
}

export default KinopoiskConnector;
