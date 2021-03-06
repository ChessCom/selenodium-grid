'use strict';

var q = require('q'),
    qs = require('qs'),
    url = require('url'),
    apps = require('q-io/http-apps');

function HubRouter(select, registry) {
    return function(req, res) {
        return q.fcall(select, req)
            .then(function(app) {
                return app(req, res, registry);
            });
    }
}

function HandleRejections(app) {
    return function(req, res) {
        return q.fcall(app, req, res)
            .catch(function(err) {
                // real uncatched errors must pass through
                if (err instanceof Error) {
                    return q.reject(err);
                }
                // transform response rejections into normal responses
                return err;
            });
    }
}

function HandleJsonRequests(app) {
    return function(req, res) {
        return processJsonBody(req)
            .catch(function(err) {
                // TODO: should be 500 in case of syntax or any other error in processJsonBody() code
                return statusResponse(req, 400, err.stack || err);
            })
            .then(function(req) {
                return app(req, res);
            });
    }
}

function processJsonBody(obj, dropContentLengthHeader) {
    return q(obj)
        .then(function(obj) {
            var contentType = obj.headers['content-type'];
            if (contentType && contentType.indexOf('json') > -1) {
                return obj.body.read()
                    .then(function(body) {
                        if (body.length) {
                            obj.data = JSON.parse(body);
                        }
                        if (dropContentLengthHeader) {
                            delete obj.headers['content-length'];
                        }
                        return obj;
                    });
            }
            return obj;
        });
}

function HandleUrlEncodedRequests(app) {
    return function(req, res) {
        return processUrlEncodedBody(req)
            .catch(function(err) {
                // TODO: should be 500 in case of syntax or any other error in processUrlEncodedBody() code
                return statusResponse(req, 400, err.stack || err);
            })
            .then(function(req) {
                return app(req, res);
            });
    }
}

function processUrlEncodedBody(obj, dropContentLengthHeader) {
    return q(obj)
        .then(function(obj) {
            var contentType = obj.headers['content-type'];
            if (contentType && contentType.indexOf('x-www-form-urlencoded') > -1) {
                return obj.body.read()
                    .then(function(body) {
                        if (body.length) {
                            obj.data = qs.parse(body.toString());
                        }
                        if (dropContentLengthHeader) {
                            delete obj.headers['content-length'];
                        }
                        return obj;
                    });
            }
            return obj;
        });
}

function ParseRequest(app) {
    return function (req, res) {
        var parsed = url.parse(req.url);
        req.query = qs.parse(parsed.query || '');
        req.pathname = parsed.pathname;
        return app(req, res);
    };
}

function statusResponse(req, status, addendum) {
    return q.reject(apps.responseForStatus(req, status, req.method + ' ' + req.path + (addendum ? '\n' + addendum : '')));
}

apps.HubRouter = HubRouter;
apps.HandleRejections = HandleRejections;
apps.HandleJsonRequests = HandleJsonRequests;
apps.processJsonBody = processJsonBody;
apps.HandleUrlEncodedRequests = HandleUrlEncodedRequests;
apps.processUrlEncodedBody = processUrlEncodedBody;
apps.ParseRequest = ParseRequest;
apps.statusResponse = statusResponse;

module.exports = apps;
