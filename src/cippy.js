(function() {

  cippy = angular.module('cippydb', ['ng']);

  cippy.factory('Cippy', function($timeout, $q) {
    return function Cippy(ref, filter, opts) {
      var self = this;
      self.scope = null;
      self.varName = null;
      self.dbName = null;
      self.objName = null;
      self.filter = null;
      self.remoteURL = null;
      self.type = 'array';
      self.remote = null;
      self.db = null;
      self.data = null;
      self.changes = null;
      self.opts = {live: true, retry: true};

      self.init = function(ref, filter, opts) {
        // http://kabin.id:5984/cippy_arrangements/1234
        var url = ref.replace('http://', '');
        url = url.replace('https://', '');
        var parser = url.split('/');
        // console.log(url);
        if (parser.length == 2) {
          self.type = 'array';
        } else {
          self.type = 'object';
          self.objName = parser[2];
        }
        self.remoteURL = 'http://' + parser[0];
        self.dbName = parser[1];
        self.remote = self.remoteURL + '/' + self.dbName;
        console.log(self.dbName);
        self.db = new PouchDB(self.dbName, {auto_compaction: true});
        console.log(filter);
        if (filter != undefined) {
          self.filter = filter;
        }
        if (opts != undefined) {
          self.opts = opts
        }
        self.sync();
      }

      self.updateDoc = function() {
        if (self.scope != null) {
          self.scope.$apply(function() {
            self.scope[self.varName] = self.data;
          });
        }
      }

      self.syncing = function(doc) {
        var def = $q.defer();
        if (self.type == 'array') {
          // console.log(self.filter);
          if (self.filter != null) {
            self.db.query(function (doc, emit) {
              emit(doc[Object.keys(self.filter)[0]]);
            }, {startkey: self.filter[Object.keys(self.filter)[0]], endkey: self.filter[Object.keys(self.filter)[0]], include_docs: true}).then(function (docs) {
              self.data = _.map(docs.rows, function(item) {
                return item.doc;
              });
              self.updateDoc();
              def.resolve(self.data);
            });
          } else {
            self.db.allDocs({include_docs: true}).then(function (data) {
              self.data = _.map(data.rows, function(item) {
                return item.doc;
              });
              self.updateDoc();
              def.resolve(self.data);
            });
          }
        } else if (self.type == 'object') {
          // console.log(doc);
          if (doc.id == self.objName) {
            self.db.get(self.objName).then(function(doc) {
              self.data = doc;
              self.updateDoc();
              def.resolve(self.data);
            })
          }
        }
        return def.promise;
      }

      self.sync = function() {
        if (self.db) {
          self.db.sync(self.remote, self.opts);
          self.changes = self.db.changes({
            since: 'now',
            live: true,
          });
          self.changes.on('change', self.syncing);
        }
      }

      self.init(ref, filter, opts);

      self.add = function(item) {
        self.scope[self.varName].push(item);
        if (self.type == 'array') {
          if (item._id) {
            return self.db.put(item);
          } else {
            return self.db.post(item);
          }
        }
      };

      self.remove = function(item) {
        if (self.type == 'array') {
          if (item) {
            var find = _.findWhere(self.data, item);
            self.scope[self.varName] = _.without(self.data, find);
            return self.db.remove(item);
          }
        } else {
          return self.db.remove(self.data);
        }
      };

      self.clear = function() {
        if (self.type == 'array') {
          return self.db.bulkDocs(_.map(self.data, function (item) {
            var newItem = item;
            newItem['_deleted'] = true;
            return newItem;
          }));
        }
      }

      self.save = function(item) {
        if (self.type == 'array') {
          return self.db.put(item);
        } else {
          return self.db.put(item);
        }
      };

      self.bindTo = function($scope, varName) {
        self.scope = $scope;
        self.varName = varName;
        self.syncing();
      };
    };
  });

}).call(this);