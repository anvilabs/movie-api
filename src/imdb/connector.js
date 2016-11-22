/* @flow */

import DataLoader from 'dataloader';
import PromiseThrottle from 'promise-throttle';
import rp from 'request-promise-native';

import { userAgent } from '../utils';
import env from '../env';

export type ImdbConnectorConfig = {
  userId?: string,
};

class ImdbConnector {
  _userId: string;
  _ratingsRp: (options: Object) => Promise<any>;

  constructor({ userId }: ImdbConnectorConfig = {}) {
    this._userId = userId || env.getImdbUserId();

    this._ratingsRp = rp.defaults({
      headers: { 'User-Agent': userAgent },
      gzip: true,
      qs: {
        u: this._userId,
      },
    });
  }

  _ratingsThrottleQueue = new PromiseThrottle({
    requestsPerSecond: 10,
    promiseImplementation: Promise,
  });

  ratingsLoader: { load: (imdbId: string) => Promise<any> } = new DataLoader(
    (imdbIds: Array<string>) => this._ratingsThrottleQueue.addAll(
      imdbIds.map((imdbId: string) => () => this._ratingsRp({
        // eslint-disable-next-line max-len
        uri: `http://p.media-imdb.com/static-content/documents/v1/title/${imdbId}/ratings%3Fjsonp=imdb.rating.run:imdb.api.title.ratings/data.json`,
      })),
    ), {
      batch: false,
    },
  );

  ratingsGet = (imdbId: string) => this.ratingsLoader.load(imdbId);
}

export default ImdbConnector;
