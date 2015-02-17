(function () {
var DOM = {};

$(document).ready(function () {
    getDOMElements();
    bindEvents();
});

// there must be no executions beyond this line

function getDOMElements() {
    DOM.openPresBtn = $('#open-pres');
    DOM.doRemoteBtn = $('#do-remote');
    DOM.goRemoteBtn = $('#go-remote');
    DOM.presWell = $('#pres-well');
    DOM.presPreviews = DOM.presWell.find('.pres-preview');
    DOM.showBtn = DOM.presWell.find('#show');
    DOM.modal = $('#modal');
    DOM.modalContainer = $('#modal-container');
    DOM.remoteCode = $('#remote-code');
    DOM.codeInvalid = $('#code-invalid');
}

function bindEvents() {
    DOM.openPresBtn.one('click', showPresWell);
    DOM.presPreviews.click(presCheck);
    DOM.showBtn.click(showThemAll);
    DOM.doRemoteBtn.click($.fn.fadeIn.bind(DOM.modalContainer));
    DOM.modalContainer.click($.fn.fadeOut.bind(DOM.modalContainer));
    DOM.modal.click(function (e) {e.stopPropagation()});
    DOM.goRemoteBtn.click(goRemote);
    DOM.remoteCode.keyup(function (event) {
        if (event.keyCode == 13){
            DOM.goRemoteBtn.click();
        }
    });
}

function goRemote() {
    var code = DOM.remoteCode.val();
    DOM.codeInvalid.slideUp();
    $.ajax('/test_room?room=' + code).done(function (data) {
        if (data.result === false) {
            DOM.codeInvalid.slideDown();
            return;
        }
        window.location.assign(
            '/view/' + data.room.pres +
            '/?remote=' + code +
            '&slide=' + data.room.slide +
            (data.room.presList.length > 1 ? '&also=' : '') +
            data.room.presList.filter(function (element) {return element !== data.room.pres}).join('&also=')
        );
    });
}

function showPresWell() {
    $('html, body').animate({
        scrollTop: $(document).height()
    }, {
        duration:500,
        start: $.fn.slideDown.bind(DOM.presWell)
    });
}

function presCheck() {
    $(this).toggleClass('checked');
    if (DOM.presPreviews.filter('.checked').length === 0) {
        DOM.showBtn.fadeOut('fast');
    } else {
        DOM.showBtn.fadeIn('fast');
    }
}

function showThemAll() {
    var pres = [];
    var url = '';
    DOM.presPreviews.filter('.checked').each(function () {
        pres.push($(this).data('pres'));
    });
    pres.forEach(function (presName, index) {
        if (index === 0) {
            url += presName + '?';
        } else {
            url += 'also=' + presName + '&';
        }
    });

    window.location.assign('/view/' + url.replace(/.$/, ''))
}
}());
