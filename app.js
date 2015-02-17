var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var mark = require('markup-js');
var fs = require('fs');
var rooms = {};

var templatesToLoad = {
    main: 'main.html',
    singleview: 'view.html',
    error: 'error.html',
    viewImg: 'view-img.html',
    previews: 'previews.html',
    presPreviews: 'pres-previews.html',
    presPreviewsMain: 'pres-previews-main.html',
    remoteCode: 'remote-code.html'
};
var presentations = {};
var presArray = []; // Used in template engine

loadTemplates();
loadPresentationFiles();

server.listen(3000);

app.get(/(css\/.*\.css|js\/.*\.js|icons\/.*\.svg|presentations\/.*\.jpg|logo\.png|icon\.png)$/, function (req, res) {
    res.sendFile(decodeURI(req.path), {root: __dirname}, function (err) {
        if (err) {
            console.log(err);
            res.status(err.status).end();
        }
    });
});

app.get('/', function (req, res) {
    res.send(mark.up(mark.includes.main, {
        presentations: mark.up(mark.includes.presPreviewsMain, {presentations: presArray})
    }));
});

app.get('/view/:presentation', function (req, res) {
    var also = [];
    var remote = '';
    var slide = '';
    if (typeof presentations[req.params.presentation] === 'undefined') {
        res.status(404).send(mark.up(mark.includes.error, {
            errno: 404,
            text: 'No such presentation'
        }));
        return;
    }

    if (typeof req.query.also !== 'undefined') {
        if (typeof req.query.also === 'string') {
            if (typeof presentations[req.query.also] !== 'undefined') {
                also.push(req.query.also)
            }
        } else {
            req.query.also.forEach(function (element) {
                if (typeof presentations[element] !== 'undefined') {
                    also.push(element)
                }
            });
        }
    }

    if (typeof req.query.remote !== 'undefined') {
        if (typeof rooms[req.query.remote] !== 'undefined') {
            remote = req.query.remote;
        }
    }

    if (typeof req.query.slide !== 'undefined') {
        if (parseInt(req.query.slide) < presentations[req.params.presentation].length) {
            slide = req.query.slide;
        }
    }

    res.send(mark.up(mark.includes.singleview, {
        presentation: req.params.presentation,
        files: presentations[req.params.presentation],
        fileCount: presentations[req.params.presentation].length,
        filename: presentations[req.params.presentation][0].filename,
        slideTmpl: mark.includes.viewImg,
        previewsTmpl: mark.includes.previews,
        remoteCodeTmpl: mark.includes.remoteCode,
        presPreviewsMenu: mark.up(mark.includes.presPreviews, {
            presentations: presArray.filter(function (entry) {
                return also.indexOf(entry.name) >= 0;
            })
        }),
        presPreviewActive: mark.up(mark.includes.presPreviews, {
            presentations: presArray.filter(function (entry) {
                return entry.name === req.params.presentation
            })
        }),
        presentations: presArray.filter(function (entry) {
            return also.indexOf(entry.name) >= 0;
        }),
        remote: remote,
        slide: slide
    }));
});

// Remote control: we're using a unique Socket.io room for each presentation
// There are no 'masters' and 'slaves'. Every change in one participant reflects on others.
// Room name is that 6-digit code, which generates, when client presses the remote control button

io.on('connection', function (socket) {
    socket.on('new_room', newRoom);
    socket.on('join_room', function (number) {
        if (typeof rooms[number] === 'undefined') {
            socket.disconnect('no such room');
        } else {
            socket.join(number);
            socket.on('change', broadcastChange);
        }
    })
});

app.get('/test_room/', function (req, res) {
    res.send({
        result: typeof rooms[req.query.room] !== 'undefined',
        room: rooms[req.query.room]
    });
});

function newRoom(data) {
    if (typeof data.pres === 'undefined' ||
        typeof presentations[data.pres] === 'undefined' ||
        typeof data.slide === 'undefined' ||
        parseInt(data.slide) > presentations[data.pres].length - 1 ||
        typeof data.presList === 'undefined' ||
        !(data.presList instanceof Array) ||
        !(data.presList.every(function (value) { return typeof presentations[value] !== 'undefined' }))
    ) {
        this.disconnect('bad request');
        return;
    }

    var number = parseInt(Math.random() * 899999 + 100000);  // random int between 100000 and 999999
    while (typeof rooms[number] !== 'undefined') {
        number = parseInt(Math.random() * 899999 + 100000);
    }

    rooms[number] = {
        pres: data.pres,
        slide: data.slide,
        presList: typeof data.presList === 'string' ? [data.presList] : data.presList
    };

    this.join(number);
    this.emit('new_room', {room: number});
    this.on('disconnect', function () {
        if (typeof io.sockets.adapter.rooms[number] === 'undefined') {
            delete rooms[number];
        }
    });

    this.on('change', broadcastChange);
}

function broadcastChange(data) {
    if (typeof presentations[data.pres] === 'undefined' ||
        typeof parseInt(data.slide) > presentations[data.pres].length - 1 ||
        typeof rooms[data.room] === 'undefined') {
        return;
    }
    rooms[data.room].pres = data.pres;
    rooms[data.room].slide = parseInt(data.slide);
    this.to(data.room).emit('change', {
        pres: data.pres,
        slide: rooms[data.room].slide
    });
}

function loadTemplates() {
    for (var template in templatesToLoad) {
        if (templatesToLoad.hasOwnProperty(template)) {
            mark.includes[template] = fs.readFileSync('./templates/' + templatesToLoad[template], 'utf8');
        }
    }
}

function loadPresentationFiles() {
    fs.readdirSync('presentations').forEach(function (presentation) {
        presentations[presentation] = fs.readdirSync('presentations/' + presentation)
            .filter(function (filename) {
                return /.*.jpg$/.test(filename);
            })
            .map(function (filename) {
                return {filename: filename, presentation: presentation}
            });
        presArray.push({
            name: presentation,
            files: presentations[presentation]
        });
        for (var pres in presentations) {
            if (presentations.hasOwnProperty(pres)) {
                presentations[pres][0].active = true;
            }
        }
    });
}
