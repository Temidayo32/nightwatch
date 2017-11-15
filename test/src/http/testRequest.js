const nock = require('nock');
const assert = require('assert');
const mockery = require('mockery');

const common = require('../../common.js');
const HttpRequest = common.require('http/request.js');
const HttpOptions = common.require('http/options.js');
const Logger = common.require('util/logger');

module.exports = {
  'test HttpRequest' : {
    beforeEach: function (callback) {
      mockery.enable();
      Logger.setOutputEnabled(false);

      HttpRequest.globalSettings = {
        default_path: '/wd/hub'
      };

      nock('http://localhost:4444')
        .post('/wd/hub/session')
        .reply(200, {
          status: 0,
          sessionId: '123456-789',
          value: {
            javascriptEnabled: true,
            browserName: 'firefox'
          },
          state: null
        });

      callback();
    },

    afterEach: function () {
      mockery.disable();
    },

    testSendPostRequest: function (done) {
      var options = {
        path: '/session',
        data: {
          desiredCapabilities: {
            browserName: 'firefox'
          }
        }
      };

      var request = new HttpRequest(options);
      request.on('success', function () {
        done();
      }).send();

      var data = '{"desiredCapabilities":{"browserName":"firefox"}}';
      assert.equal(request.data, data);
      assert.equal(request.contentLength, data.length);

      var opts = request.reqOptions;
      assert.equal(opts.path, '/wd/hub/session');
      assert.equal(opts.hostname, 'localhost');
      assert.equal(opts.port, 4444);
      assert.equal(opts.method, 'POST');
      assert.deepEqual(opts.headers, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': data.length
      });
    },

    testSendPostRequestWithCredentials: function (done) {
      var options = {
        path: '/session',
        data: {
          desiredCapabilities: {
            browserName: 'firefox'
          }
        }
      };

      HttpRequest.globalSettings = {
        credentials: {
          username: 'test',
          key: 'test-key'
        }
      };

      var request = new HttpRequest(options);
      request.on('success', function () {
        done();
      }).send();


      var authHeader = new Buffer('test:test-key').toString('base64');
      assert.equal(request.httpRequest.getHeader('Authorization'), 'Basic ' + authHeader);
    },

    testSendPostRequestWithProxy: function (done) {
      function ProxyAgentMock(uri) {
        this.proxy = uri;
      }

      mockery.registerMock('proxy-agent', ProxyAgentMock);

      var options = {
        path: '/session',
        data: {
          desiredCapabilities: {
            browserName: 'firefox'
          }
        }
      };

      HttpRequest.globalSettings = {
        proxy: 'http://localhost:8080'
      };

      var request = new HttpRequest(options);
      request.on('success', function () {
        done();
      }).send();

      var opts = request.reqOptions;
      assert.ok('agent' in opts);
      assert.ok('proxy' in opts.agent);

      HttpRequest.globalSettings = {
        proxy: null
      };
    },

    testResponseWithRedirect: function (done) {
      nock('http://localhost:4444')
        .post('/wd/hub/redirect')
        .reply(302, {}, {
          Location: 'http://localhost/wd/hub/session'
        });

      var options = {
        path: '/redirect',
        data: {}
      };
      var request = new HttpRequest(options);
      request.on('success', function (result, response, redirected) {
        assert.strictEqual(redirected, true);
        done();
      }).send();

    },

    testGetRequest: function (done) {
      nock('http://localhost:4444')
        .get('/wd/hub/123456/element')
        .reply(200, {});

      var options = {
        path: '/:sessionId/element',
        method: 'GET',
        sessionId: '123456'
      };

      var request = new HttpRequest(options);
      request.on('success', function (result) {
        done();
      }).send();

      assert.equal(request.httpRequest.getHeader('Accept'), 'application/json');
      assert.equal(request.reqOptions.path, '/wd/hub/123456/element');
    },

    testErrorResponse: function (done) {
      nock('http://localhost:4444')
        .post('/wd/hub/error')
        .reply(500, {
          value: {
            status: -1,
            stackTrace: '{}',
            message: 'Unable to locate element'
          }
        });

      var options = {
        path: '/wd/hub/error',
        method: 'POST',
        data: {}
      };

      var request = new HttpRequest(options);
      request.on('error', function (result, response, screenshotContent) {
        assert.equal(typeof result.stackTrace, 'undefined');
        assert.equal(typeof result.message, 'undefined');
        done();
      }).send();

    },

    testErrorResponseLocalised: function (done) {
      nock('http://localhost:4444')
        .post('/wd/hub/error')
        .reply(500, {
          value: {
            status: -1,
            stackTrace: '{}',
            localizedMessage: 'no such element',
            message: 'no such element'
          }
        });

      var options = {
        path: '/wd/hub/error',
        method: 'POST',
        data: {}
      };

      var request = new HttpRequest(options);
      request.on('error', function (result, response, screenshotContent) {
        assert.ok(typeof result.stackTrace == 'undefined');
        assert.ok(typeof result.localizedMessage == 'undefined');
        assert.ok(typeof result.message == 'undefined');
        done();
      }).send();
    }
  }

};
