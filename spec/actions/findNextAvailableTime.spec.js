const { Logger } = require('@elastic.io/component-commons-library');
const nock = require('nock');
const chai = require('chai');
const sinon = require('sinon');

const { expect } = chai;
const logger = Logger.getLogger();
const action = require('../../lib/actions/findNextAvailableTime');

const configuration = require('../data/configuration.new.in.json');
const jsonIn = require('../data/findNextAvailableTime_test.in.json');
const jsonOut = require('../data/findNextAvailableTime_test.out.json');

const cfgString = JSON.stringify(configuration);

describe('Outlook Find next available time', () => {
  const refreshTokenUri = 'https://login.microsoftonline.com';
  const refreshTokenApi = '/common/oauth2/v2.0/token';
  const microsoftGraphUri = 'https://graph.microsoft.com/v1.0';
  const microsoftGraphApi = '/me/events';

  let self;
  let cfg;
  beforeEach(() => {
    cfg = JSON.parse(cfgString);
    self = {
      emit: sinon.spy(),
      logger,
    };
  });

  it('should return nextAvailable time on success request - case: http 200', (done) => {
    const scope1 = nock(refreshTokenUri).post(refreshTokenApi)
      .reply(200, {
        access_token: 1,
        expires_in: 3600,
      });

    const scope2 = nock(microsoftGraphUri).get(microsoftGraphApi)
      .query({
        $filter: `start/dateTime le '${jsonIn.time}' and end/dateTime ge '${jsonIn.time}'`,
      })
      .reply(200, jsonOut);

    function checkResults(data) {
      const { callCount, args } = self.emit;
      expect(callCount).to.eql(1);
      expect(args[0][0]).to.eql('updateKeys');
      expect(args[0][1].access_token).to.eql(1);

      const { time, subject } = jsonIn;

      expect(data.body).to.eql({
        time,
        subject,
      });
      expect(scope1.isDone()).to.eql(true);
      expect(scope2.isDone()).to.eql(true);
    }

    action.process.call(self, {
      body: jsonIn,
    }, cfg, {})
      .then(checkResults)
      .then(done)
      .catch(done.fail);
  });

  it('should throw error on unsuccessful refresh token request', (done) => {
    const scope1 = nock(refreshTokenUri).post(refreshTokenApi)
      .reply(401, {
        access_token: 1,
      });

    action.process.call(self, {
      body: jsonIn,
    }, cfg, {})
      .then(() => done.fail(new Error('Error is expected')))
      .catch((err) => {
        expect(err.message).to.contains('Error in authentication.  Status code: 401');
        expect(scope1.isDone()).to.eql(true);
        done();
      });
  });
});
