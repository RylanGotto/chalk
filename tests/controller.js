/**
 * Created by rylan on 13/01/15.
 */
angular.module("myapp", []).controller("MyController", function ($scope, $http) {
    $scope.myData = {};

    $scope.test = "ryla is the best";

    var url = "http://192.168.0.4:8080";

    $scope.myData.regClick = function (item, event) {
        var dataObj = {
            username: $scope.myData.username,
            password: $scope.myData.password,
            email: $scope.myData.email

        };
        $http.defaults.headers.common['x-auth'] = "";
        //REGISTER A NEW USER
        var res = $http.post(url + '/api/auth/register', dataObj);
        res.success(function (data, status, headers, config) {
            alert(JSON.stringify({data: data}));
        });
        res.error(function (data, status, headers, config) {
            alert("failure message: " + JSON.stringify({data: data}));
        });

    }

    $scope.myData.logClick = function (item, event) {
        var dataObj1 = {
            username: $scope.myData.username,
            password: $scope.myData.password

        };

        $http.defaults.headers.common['x-auth'] = "";
        //LOG A NEW USER IN
        var res = $http.post(url + '/api/auth/login', dataObj1);
        res.success(function (data, status, headers, config) {
            alert(data.tok);
            localStorage.jwttoken = data.tok;
            localStorage.id = data.usr._id;

        });
        res.error(function (data, status, headers, config) {
            alert("failure message: " + JSON.stringify({data: data}));
        });

    }

    $scope.myData.tokClick = function (item, event) {


        //RETRIEVE RESPONSE FROM LOGIN AND SET X-AUTH HEADER TO ACCESS RESTRICTED RESOURCES
        $http.defaults.headers.common['x-auth'] = localStorage.jwttoken;
        var res = $http.post(url + '/api/users');
        res.success(function (data, status, headers, config) {
            alert(JSON.stringify({data: data}));
        });
        res.error(function (data, status, headers, config) {
            alert("failure message: " + JSON.stringify({data: data}));
        });

    }

    $scope.myData.test = function (item, event) {


        //RETRIEVE RESPONSE FROM LOGIN AND SET X-AUTH HEADER TO ACCESS RESTRICTED RESOURCES
        $http.defaults.headers.common['x-auth'] = localStorage.jwttoken;
        var res = $http.post(url + '/api/test', {data:"words"});
        res.success(function (data, status, headers, config) {
            alert(JSON.stringify({data: data}));
        });
        res.error(function (data, status, headers, config) {
            alert("failure message: " + JSON.stringify({data: data}));
        });

    }

    $scope.myData.tokusrClick = function (item, event) {


        //RETRIEVE RESPONSE FROM LOGIN AND SET X-AUTH HEADER TO ACCESS RESTRICTED RESOURCES
        $http.defaults.headers.common['x-auth'] = localStorage.jwttoken;
        var res = $http.get(url + '/api/users');
        res.success(function (data, status, headers, config) {
            $scope.myData.users = data;
            localStorage.friendid = data[2]._id;
            localStorage.friendusername = data[2].username;
            $scope.myData.friendid = data[2]._id;
        });
        res.error(function (data, status, headers, config) {
            alert("failure message: " + JSON.stringify({data: data}));
        });

    }

    $scope.myData.createPost = function (item, event) {
        var dataObj2 = {
            tag: 'ry\'s Board',
            content: "A Test post",
            privacyLevel: 1,
            timeout: 9
        };

        $http.defaults.headers.common['x-auth'] = localStorage.jwttoken;
        console.log(localStorage.jwttoken);
        var res = $http.post(url + '/api/posts', dataObj2);
        res.success(function (data, status, headers, config) {
            alert(JSON.stringify({data: data}));
        });
        res.error(function (data, status, headers, config) {
            alert("failure message: " + JSON.stringify({data: data}));
        });

    }
    $scope.myData.createBoard = function (item, event) {
        var dataObj3 = {
            tag: 'test1',
            owner: "A owner",
            privacyLevel: 1,
            timeout: 9,
            maxTTL: 1
        };

        $http.defaults.headers.common['x-auth'] = localStorage.jwttoken;
        console.log(localStorage.jwttoken);
        var res = $http.post(url + '/api/boards', dataObj3);
        res.success(function (data, status, headers, config) {
            alert(JSON.stringify({data: data}));
        });
        res.error(function (data, status, headers, config) {
            alert("failure message: " + JSON.stringify({data: data}));
        });

    }

    $scope.myData.getAllMyBoards = function (item, event) {

        $http.defaults.headers.common['x-auth'] = localStorage.jwttoken;
        var res = $http.get(url + '/api/boards');
        res.success(function (data, status, headers, config) {
            alert(JSON.stringify({data: data}));
        });
        res.error(function (data, status, headers, config) {
            alert("failure message: " + JSON.stringify({data: data}));
        });

    }
    $scope.myData.getMyBoard = function (item, event) {

        $http.defaults.headers.common['x-auth'] = localStorage.jwttoken;
        var res = $http.get(url + '/api/myboard');
        res.success(function (data, status, headers, config) {
            alert(JSON.stringify({data: data}));
        });
        res.error(function (data, status, headers, config) {
            alert("failure message: " + JSON.stringify({data: data}));
        });

    }

    $scope.myData.getUserWithID = function (item, event) {

        $http.defaults.headers.common['x-auth'] = localStorage.jwttoken;
        var res = $http.get(url + '/api/users/' + localStorage.id);
        res.success(function (data, status, headers, config) {
            alert(JSON.stringify({data: data}));
        });
        res.error(function (data, status, headers, config) {
            alert("failure message: " + JSON.stringify({data: data}));
        });


    }

    $scope.myData.addFriend = function (item, event) {
        var dataObj4 = {
            friendid: localStorage.friendid
        };
        $http.defaults.headers.common['x-auth'] = localStorage.jwttoken;
        var res = $http.put(url + '/api/users/' + localStorage.id, dataObj4);
        res.success(function (data, status, headers, config) {
            alert(JSON.stringify({data: data}));
            alert("Added friend id: " + localStorage.friendid + "\n" + "Added friend username: " + localStorage.friendusername);
        });
        res.error(function (data, status, headers, config) {
            alert("failure message: " + JSON.stringify({data: data}));
        });


    }
    $scope.myData.updateEmail = function (item, event) {
        var dataObj5 = {
            email: $scope.myData.email
        };
        $http.defaults.headers.common['x-auth'] = localStorage.jwttoken;
        var res = $http.put(url + '/api/users/' + localStorage.id, dataObj5);
        res.success(function (data, status, headers, config) {
            alert(JSON.stringify({data: data}));
        });
        res.error(function (data, status, headers, config) {
            alert("failure message: " + JSON.stringify({data: data}));
        });
    }

    $scope.myData.deleteUser = function (item, event) {
        var dataObj6 = {
            delete: $scope.myData.idToDelete
        };
        $http.defaults.headers.common['x-auth'] = localStorage.jwttoken;
        var res = $http.put(url + '/api/users/' + localStorage.id, dataObj6);
        res.success(function (data, status, headers, config) {
            alert(JSON.stringify({data: data}));
        });
        res.error(function (data, status, headers, config) {
            alert("failure message: " + JSON.stringify({data: data}));
        });


    }

    $scope.myData.regDevice = function (item, event) {
        var dataObj7 = {
            type: "android",
            token: "random token"
        };

        $http.defaults.headers.common['x-auth'] = localStorage.jwttoken;
        console.log(localStorage.jwttoken);
        var res = $http.post(url + '/api/push/subscribe', dataObj7);
        res.success(function (data, status, headers, config) {
            alert(JSON.stringify({data: data}));
        });
        res.error(function (data, status, headers, config) {
            alert("failure message: " + JSON.stringify({data: data}));
        });

    }

    $scope.myData.delDevice = function (item, event) {

        $http.defaults.headers.common['x-auth'] = localStorage.jwttoken;
        console.log(localStorage.jwttoken);
        var res = $http.post(url + '/api/push/unsubscribe');
        res.success(function (data, status, headers, config) {
            alert(JSON.stringify({data: data}));
        });
        res.error(function (data, status, headers, config) {
            alert("failure message: " + JSON.stringify({data: data}));
        });

    }






});
