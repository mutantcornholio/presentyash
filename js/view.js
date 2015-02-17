(function () {
var DOM;
var templates;
var menuesShown;
var presPreviewArrowShown = false;
var presentations = [];
var currentPresentation = 0;
var preloadList = [];
var remoteSocket;
var remoteRoom;
var animationLock = false;  // created to prevent animation race conditions and HELL ON EARTH,
                            // when user click on everything he sees, while fancy animation is running

var isTouchDevice = 'ontouchstart' in document.documentElement;

$(document).ready(function () {
    DOM = getDOMElements();
    menuesShown = DOM.menu.is(':visible');
    templates = getTemplates();

    if (isTouchDevice === true) {
        changeToTouchDevice();
    }

    testServices();
    getPresentations();
    makePreloadList();
    bindEvents();
    correctPresPreviewSubstratePosition();
    launchRemoteIfShould();
});

// there must be no executions beyond this line

function Presentation(selector, index) {
    var self = this;
    this.index = index;
    this.presPreview = $(selector);
    this.presName = this.presPreview.data('pres');
    this.files = this.presPreview.data('files').slice(0, -1).split(';').
        map(function (element) {
            return {
                presentation: self.presName,
                filename: element
            }
        });
    this.slidecount = this.files.length;
    this.currentSlide = 0;

    return this;
}

Presentation.prototype.nextSlide = function () {
    if (this.currentSlide < this.files.length - 1) {
        this.currentSlide++;
        this.drawSlide();
    }
};

Presentation.prototype.prevSlide = function () {
    if (this.currentSlide > 0) {
        this.currentSlide--;
        this.drawSlide();
    }
};

Presentation.prototype.firstSlide = function () {
    this.currentSlide = 0;
    this.drawSlide();
};

Presentation.prototype.lastSlide = function () {
    this.currentSlide = this.files.length - 1;
    this.drawSlide();
};

Presentation.prototype.drawSlide = function (noscroll, nobroadcast) {
    // noscroll disables autoscrolling to the current slide preview
    // nobroadcast disables broadcasting event to remote connections
    DOM.viewArea.empty();
    DOM.viewArea.html(Mark.up(templates.slideTemplate, {
        presentation: this.presName,
        filename: this.files[this.currentSlide].filename
    }));
    DOM.previews.removeClass('active');
    DOM.previews[this.currentSlide].classList.add('active');
    DOM.currentSlideSpan.text(this.currentSlide + 1);
    DOM.slideInput.val(this.currentSlide + 1);
    this.presPreview.find('img').prop('src',
        '/presentations/' + this.presName + '/400x300/' + this.files[this.currentSlide].filename);
    if (noscroll !== true) {
        this.scrollSlideViewerToCurrent();
    }
    if (this.currentSlide === 0) {
        DOM.prevSlideBtn.addClass('disabled');
    } else {
        DOM.prevSlideBtn.removeClass('disabled');
    }

    if (typeof remoteSocket !== 'undefined' && nobroadcast !== true) {
        remoteSocket.emit('change', {
            pres: this.presName,
            slide: this.currentSlide,
            room: remoteRoom
        });
    }
};

Presentation.prototype.makeActual = function () {
    this.files[this.currentSlide].active = true;
    DOM.slideMenu.html(Mark.up(templates.previewsTemplate, {
        files: this.files
    }));
    this.files[this.currentSlide].active = false;
    DOM.currentSlideSpan.text(this.currentSlide);
    DOM.slideTotalSpan.text(this.slidecount);
    DOM.slideInput.attr('max', this.slidecount);
    DOM.slideInput.val(this.currentSlide);
    DOM.previews = $('.preview');
    DOM.previews.click(previewsClick);
    this.drawSlide();
    currentPresentation = this.index;
};

Presentation.prototype.scrollSlideViewerToCurrent = function () {
    if (this.currentSlide + 1 === this.slidecount) {
        DOM.slideMenu.animate({scrollTop:DOM.slideMenu.height()}, 'fast');
        return;
    }
    var preview = $(DOM.previews[this.currentSlide]);
    var previewOffset = preview.offset().top;
    var nextOffset = $(DOM.previews[this.currentSlide + 1]).offset().top;
    var previewHeight = preview.height();
    var slideMenuHeight = DOM.slideMenu.height();
    var offset = (nextOffset - previewOffset) * (this.currentSlide) +
        (previewHeight) - (slideMenuHeight / 2);
    DOM.slideMenu.animate({scrollTop:offset}, 'fast');
};

function getPresentations() {
    DOM.presPreviews.each(function (index) {
        presentations.push(new Presentation(this, index));
        if ($(this).parent().is(DOM.presMenuActive)) {
            currentPresentation = index;
        }
    });
}

function changeToTouchDevice() {
    DOM.slideMenu.css('margin-right', 0);
    DOM.slideMenu.css('width', '12rem');
    DOM.buttonMenu.hide();
    DOM.prevSlideBtn.height(DOM.slideMenu.height() + DOM.slideMenu.offset().top);
    window.addEventListener('orientationchange', function () {
        DOM.prevSlideBtn.height(DOM.menuButton.height() + DOM.menuButton.offset().top)
    });
}

function bindEvents() {
    DOM.previews.click(previewsClick);
    DOM.firstSlideBtn.click(function () {
        presentations[currentPresentation].firstSlide()
    });
    DOM.lastSlideBtn.click(function () {
        presentations[currentPresentation].lastSlide()
    });
    DOM.prevSlideBtn.click(function () {
        presentations[currentPresentation].prevSlide()
    });
    DOM.viewArea.click(function () {
        presentations[currentPresentation].nextSlide()
    });
    DOM.slideInput.change(slideInputChangeHandler);
    DOM.freeArea.click(function () {
        if (menuesShown === true) {
            menuesShown = false;
            DOM.menu.fadeOut('fast');
        }
    });
    DOM.menuButton.click(function () {
        if (menuesShown === false) {
            menuesShown = true;
            DOM.menu.fadeIn('fast');
        }
    });
    DOM.presPreviews.click(changePres);
    DOM.fullscreenBtn.click(toggleFullscreen);
    $(document).on('webkitfullscreenchange mozfullscreenchange fullscreenchange MSFullscreenChange',
        $.fn.toggleClass.bind(DOM.fullscreenBtn, 'fullscreen'));
    $(document).keydown(function (event) {
        if (event.which === 37) {
            presentations[currentPresentation].prevSlide();
            event.preventDefault();
        } else if (event.which === 39 || event.which === 32) {
            presentations[currentPresentation].nextSlide();
            event.preventDefault();
        }
    });
    $(window).resize(correctPresPreviewSubstratePosition);
    DOM.presPreviewArrowLeft.click(scrollPresPreviewLeft);
    DOM.presPreviewArrowRight.click(scrollPresPreviewRight);
    DOM.viewArea.find('img').one('load', preload);
    DOM.remoteBtn.click(remoteConnection.bind(undefined, undefined));
    DOM.modal.on('click', '.close', $.fn.fadeOut.bind(DOM.modalContainer));
    DOM.modalContainer.click($.fn.fadeOut.bind(DOM.modalContainer));
    DOM.modal.click(function (e) {e.stopPropagation()});
}

function previewsClick() {
    var number = $(this).data('number');
    presentations[currentPresentation].currentSlide = parseInt(number - 1);
    presentations[currentPresentation].drawSlide(true);
}

function getDOMElements() {
    return {
        body: $('body'),
        menu: $('.hidden-menu'),
        menuButton: $('#show-menues-btn'),
        viewArea: $('.view-area'),
        viewAreaPreload: $('#view-area-preload'),
        slideMenu: $('.slide-menu'),
        freeArea: $('.free-area'),
        previews: $('.preview'),
        presPreviews: $('.pres-preview'),
        presMenuActive: $('#active-pres'),
        presMenu: $('#pres-menu'),
        presPreviewSubstrate: $('#preview-substrate'),
        presPreviewArrowLeft: $('#pres-scroll-left'),
        presPreviewArrowRight: $('#pres-scroll-right'),
        firstSlideBtn: $('#first-slide-btn'),
        lastSlideBtn: $('#last-slide-btn'),
        prevSlideBtn: $('#prev-slide-btn'),
        slideInput: $('#slide-input'),
        currentSlideSpan: $('#current-slide'),
        slideTotalSpan: $('#slide-count'),
        fullscreenBtn: $('#fullscreen-btn'),
        remoteBtn: $('#remote-btn'),
        buttonMenu: $('#button-menu'),
        modal: $('#modal'),
        modalContainer: $('#modal-container')
    }
}

function getTemplates() {
    return {
        slideTemplate: $('#slide-tmpl').html(),
        previewsTemplate: $('#previews-tmpl').html(),
        remoteCodeTemplate: $('#remote-code-tmpl').html()
    }
}

function slideInputChangeHandler() {
    var self = $(this);
    var val = parseInt(self.val());
    if (val > presentations[currentPresentation].slidecount) {
        self.val(presentations[currentPresentation].slidecount);
        presentations[currentPresentation].currentSlide = presentations[currentPresentation].slidecount - 1;
    } else if (val < 1) {
        self.val(1);
        presentations[currentPresentation].currentSlide = 0;
    } else {
        presentations[currentPresentation].currentSlide = val - 1;
    }
    presentations[currentPresentation].drawSlide();
}

function changePres() {
    if (animationLock) {
        return;
    }

    var self = $(this);
    var olderBro = self.prev();
    var that = presentations[currentPresentation].presPreview;
    if (self.is(that)) {
        return;
    }

    // change presentation previews
    animationLock = true;
    self.css('z-index', 11);
    that.css('z-index', 2);

    self.animate({
        left: that.offset().left - self.offset().left +
            ((self.css('left') === 'auto') ? 0 : parseFloat(self.css('left')))
    }, 500);
    that.animate({
        left: self.offset().left - that.offset().left +
        ((that.css('left') === 'auto') ? 0 : parseFloat(that.css('left')))
    }, 500);
    DOM.presPreviews.promise().done(function () {
        self.css('z-index', 3);
        that.css('z-index', 3);

        that.css('left', 'auto');
        if (olderBro.length !== 0) {
            olderBro.after(that);
        } else {
            DOM.presPreviewSubstrate.prepend(that)
        }
        self.css('left', 'auto');
        DOM.presMenuActive.append(self);

        presentations.some(function (pres) {
            if (pres.presPreview.is(self)) {
                pres.makeActual();
                return true;
            } else {
                return false;
            }
        });
        animationLock = false;
    });
}

function testServices() {
    if (!document.fullscreenEnabled &&
        !document.webkitFullscreenEnabled &&
        !document.mozFullScreenEnabled &&
        !document.msFullscreenEnabled) {
        DOM.fullscreenBtn.hide();
    }
}

function correctPresPreviewSubstratePosition() {
    var baseLength = DOM.presMenu.width() - (2 * DOM.presPreviewArrowLeft.width());
    var substrateLength = DOM.presPreviewSubstrate.width();
    var margin = -parseFloat(DOM.presPreviewSubstrate.css('margin-right'));

    if (presPreviewArrowShown === false && substrateLength > baseLength) {
        DOM.presPreviewArrowLeft.show();
        DOM.presPreviewArrowRight.show();
        DOM.presPreviewArrowLeft.removeClass('disabled');
        DOM.presPreviewArrowRight.addClass('disabled');

        DOM.presPreviewSubstrate.css('margin-left', '3.5rem');
        DOM.presPreviewSubstrate.css('right', '3.5rem');
        presPreviewArrowShown = true;
    }

    if (substrateLength - margin < baseLength) {
        if (substrateLength < baseLength) {
            DOM.presPreviewSubstrate.css('margin-right', 0);
            DOM.presPreviewArrowLeft.hide();
            DOM.presPreviewArrowRight.hide();
            DOM.presPreviewSubstrate.css('margin-left', '1rem');
            DOM.presPreviewSubstrate.css('right', '1rem');
            presPreviewArrowShown = false;
        } else {
            // (baseLength - substrateLength) because margin should be negative
            DOM.presPreviewSubstrate.css('margin-right', (baseLength - substrateLength) + 'px');
        }
    }
}

function scrollPresPreviewRight() {
    if ($(this).hasClass('disabled')) {
        return;
    }

    var margin = -parseFloat(DOM.presPreviewSubstrate.css('margin-right'));
    if (margin > 0) {
        DOM.presPreviewSubstrate.css('margin-right', 'calc(9.6rem - ' + margin + 'px)');
        margin = -parseFloat(DOM.presPreviewSubstrate.css('margin-right'));
        if (margin <= 0) {
            DOM.presPreviewSubstrate.css('margin-right', '0');
            DOM.presPreviewArrowRight.addClass('disabled');
        }
        DOM.presPreviewArrowLeft.removeClass('disabled');

    }
}

function scrollPresPreviewLeft() {
    if ($(this).hasClass('disabled')) {
        return;
    }

    var margin = -parseFloat(DOM.presPreviewSubstrate.css('margin-right'));
    var baseLength = DOM.presMenu.width() - (2 * DOM.presPreviewArrowLeft.width());
    var substrateLength = DOM.presPreviewSubstrate.width();

    if (substrateLength > baseLength + margin) {
        DOM.presPreviewSubstrate.css('margin-right', 'calc(-9.6rem - ' + margin + 'px)');
        margin = -parseFloat(DOM.presPreviewSubstrate.css('margin-right'));
        if (substrateLength <= baseLength + margin) {
            DOM.presPreviewSubstrate.css('margin-right', (-substrateLength + baseLength) + 'px');
            DOM.presPreviewArrowLeft.addClass('disabled');
        }
        DOM.presPreviewArrowRight.removeClass('disabled');
    }

}

function makePreloadList() {
    presentations[currentPresentation].files.forEach(function (file) {
        preloadList.push(file);
    });
    presentations.forEach(function (presentation) {
        if (presentation.index === currentPresentation) {
            return;
        }
        presentation.files.forEach(function (file) {
            preloadList.push(file);
        })
    });
    preloadList.splice(0, 1);
}

function preload() {
    DOM.viewAreaPreload.html(Mark.up(templates.slideTemplate, {
        presentation: preloadList[0].presentation,
        filename: preloadList[0].filename,
        preload: true
    }));
    preloadList.splice(0, 1);
    if (preloadList.length > 0) {
        DOM.viewAreaPreload.find('img').on('load', preload);
    }
}

function remoteConnection(room) {
    if (typeof remoteSocket !== 'undefined') {
        DOM.modal.html(Mark.up(templates.remoteCodeTemplate, {
            code: remoteRoom
        }));
        DOM.modalContainer.fadeIn();
        return;
    }

    var socket = io(window.location.hostname + ':' + window.location.port);
    var presList = presentations.map(function (pres) {
        return pres.presName});

    if (typeof room === 'undefined') {
        socket.emit('new_room', {
            pres: presentations[currentPresentation].presName,
            slide: presentations[currentPresentation].currentSlide,
            presList: presList
        });
        socket.on('new_room', function (data) {
            DOM.modal.html(Mark.up(templates.remoteCodeTemplate, {
                code: data.room
            }));
            DOM.modalContainer.fadeIn();
            remoteSocket = socket;
            remoteRoom = data.room;
        });
    } else {
        socket.emit('join_room', room);
        remoteSocket = socket;
        remoteRoom = room;
    }
    socket.on('change', changeFromRemote);
}

function changeFromRemote(data) {
    if (presentations[currentPresentation].presName !== data.pres) {
        presentations.some(function (pres) {
            if (pres.presName !== data.pres) {
                return false;
            }
            pres.currentSlide = data.slide;
            pres.presPreview.click();
        })
    }
    presentations[currentPresentation].currentSlide = data.slide;
    presentations[currentPresentation].drawSlide(false, true);
}

function launchRemoteIfShould() {

    var room = DOM.body.data('remote');
    var slide = DOM.body.data('slide');
    if (room !== '' && slide !== '') {
        presentations[currentPresentation].currentSlide = slide;
        presentations[currentPresentation].drawSlide(false, true);
        presentations[currentPresentation].presPreview.click();

        remoteConnection(room)
    }
}

// this method is complete copypaste from developer.mozilla.org
// sadly, fullscreen API still doesn't work without prefixes
function toggleFullscreen() {
    if (!document.fullscreenElement &&
        !document.mozFullScreenElement &&
        !document.webkitFullscreenElement &&
        !document.msFullscreenElement) {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
            document.documentElement.msRequestFullscreen();
        } else if (document.documentElement.mozRequestFullScreen) {
            document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

})();
