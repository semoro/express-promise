var resolveAsync = function(object, callback, maxDeep, currentDeep) {
  if (!object || typeof object !== 'object') {
    return callback(null, object);
  }
  if (typeof object.then === 'function') {
    return object.then(function(result) {
      callback(null, result);
    }, function(err) {
      callback(err);
    });
  }

  if (!currentDeep) {
    currentDeep = 1;
  }

  var remains = [];
  Object.keys(object).forEach(function(key) {
    if (currentDeep < maxDeep &&
        typeof object[key] === 'object') {
      remains.push({
        key: key,
      });
    } else if (object[key] &&
               typeof object[key].then === 'function') {
      object[key].key = key;
      remains.push(object[key]);
    }
  });

  if (!remains.length) {
    return callback(null, object);
  }
  var pending = remains.length;

  remains.forEach(function(item) {
    function handleDone(err, result) {
      if (err) {
        return callback(err);
      }
      object[item.key] = result;
      if (--pending === 0) {
        callback(null, object);
      }
    }
    if (typeof item.then === 'function') {
      item.then(function(result) {
        handleDone(null, result);
      }, function(err) {
        handleDone(err);
      });
    } else {
      resolveAsync(object[item.key], handleDone, maxDeep, currentDeep + 1);
    }
  });
};

var expressPromise = function(options) {
  var defaultOptions = {
    methods: ['json', 'jsonp', 'render', 'send'],
    maxDeep: 5
  };

  options = options || {};
  Object.keys(defaultOptions).forEach(function(key) {
    if (typeof options[key] === 'undefined') {
      options[key] = defaultOptions[key];
    }
  });

  return function(_, res, next) {
    if (typeof next !== 'function') {
      next = function() {};
    }
    if (~options.methods.indexOf('json')) {
      var originalResJson = res.json.bind(res);
      res.json = function() {
        var args = arguments;
        var body = args[0];
        if (2 === args.length) {
          // res.json(body, status) backwards compat
          if ('number' === typeof args[1]) {
            status = args[1];
          } else {
            status = body;
            body = args[1];
          }
        }
        resolveAsync(body, function(err, result) {
          if (err) {
            return next(err);
          }
          if (typeof status !== 'undefined') {
            originalResJson(status, result);
          } else {
            originalResJson(result);
          }
        }, options.maxDeep);
      };
    }

    if (~options.methods.indexOf('jsonp')) {
      var originalResJsonp = res.jsonp.bind(res);
      res.jsonp = function() {
        var args = arguments;
        var body = args[0];
        if (2 === args.length) {
          // res.json(body, status) backwards compat
          if ('number' === typeof args[1]) {
            status = args[1];
          } else {
            status = body;
            body = args[1];
          }
        }
        resolveAsync(body, function(err, result) {
          if (err) {
            return next(err);
          }
          if (typeof status !== 'undefined') {
            originalResJsonp(status, result);
          } else {
            originalResJsonp(result);
          }
        }, options.maxDeep);
      };
    }

    if (~options.methods.indexOf('render')) {
      var originalResRender = res.render.bind(res);
      res.render = function(view, obj, fn) {
        obj = obj || {};
        if (arguments.length === 1) {
          return originalResRender(view);
        }
        if (arguments.length === 2) {
          if (typeof obj === 'function') {
            return originalResRender(view, obj);
          }
          resolveAsync(obj, function(err, result) {
            if (err) {
              return next(err);
            }
            originalResRender(view, result);
          }, options.maxDeep);
          return;
        }
        resolveAsync(obj, function(err, result) {
          if (err) {
            return next(err);
          }
          originalResRender(view, result, fn);
        }, options.maxDeep);
      };
    }

    if (~options.methods.indexOf('send')) {
      var originalResSend = res.json.bind(res);
      res.json = function() {
        var args = arguments;
        var body = args[0];
        if (2 === args.length) {
          // res.json(body, status) backwards compat
          if ('number' === typeof args[1]) {
            status = args[1];
          } else {
            status = body;
            body = args[1];
          }
        }
        if (typeof body === 'object' && !(body instanceof Buffer)) {
          resolveAsync(body, function(err, result) {
            if (err) {
              return next(err);
            }
            if (typeof status !== 'undefined') {
              originalResSend(status, result);
            } else {
              originalResSend(result);
            }
          }, options.maxDeep);
        } else {
          if (status) {
            originalResSend(status, body);
          } else {
            originalResSend(body);
          }
        }
      };
    }
  };
};

module.exports = expressPromise;