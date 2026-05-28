set_cookie('paginaAtual', 'produto');

function toggleFullScreen() {
    document.requestFullscreen();
}
//AVALIAÇÕES
function avaliação(id, fullid, ação) {
    corForte = $('#corForte').text();
    corFraca = $('#corFraca').text();

    corLike = $('#corLike' + id).css('color');
    corUnlike = $('#corUnlike' + id).css('color');

    likes = $('#likes' + id).text();
    unlikes = $('#unlikes' + id).text();

    $.ajax({
        url: $('#caminhoBase').text() + '/api/',
        type: "POST",
        async: true,
        data: 'metodo=avaliação&id=' + id + '&fullid=' + fullid + '&ação=' + ação + '&corForte=' + corForte + '&corFraca=' + corFraca + '&corLike=' + corLike + '&corUnlike=' + corUnlike + '&likes=' + likes + '&unlikes=' + unlikes,
        dataType: "html",
        success: function (resposta) {
            resposta = resposta.trim();

            resposta = resposta.split('|');
            $('#likes' + id).text(resposta[0]);
            $('#unlikes' + id).text(resposta[1]);

            $('.corLike' + id).css('color', resposta[2]);
            $('#corLike' + id).css('color', resposta[2]);
            $('#botaoLike' + id).css('border-color', resposta[2]);

            $('.corUnlike' + id).css('color', resposta[3]);
            $('#corUnlike' + id).css('color', resposta[3]);
            $('#botaoUnlike' + id).css('border-color', resposta[3]);

        }
    });
    return;
}

function selecionarVariação(fullid, variação, atributo, ir) {
    let totalDeAtributosDaVariação = $('.totalDeAtributosDaVariação' + variação).text();
    for (c = 0; c < totalDeAtributosDaVariação; c++) {
        if (parseInt(c) == parseInt(atributo)) {
            $('.variação' + variação + 'atributo' + atributo).css('border', 'solid 2px #3483fa');
        } else {
            $('.variação' + variação + 'atributo' + c).css('border', 'dashed 1px rgba(0,0,0,.25)');
        }
    }
    textoDoAtributo = $('.textovariação' + variação + 'atributo' + atributo).text();
    $('.atributoDaVariação' + variação).text(textoDoAtributo);

    imagemDoAtributo = $('.imagemvariação' + variação + 'atributo' + atributo).text();
    $('.imagemDaVariação' + variação).css('background-image', 'url("' + imagemDoAtributo + '")');

    fullidAtributo = $('.fullidvariação' + variação + 'atributo' + atributo).text();
    if (fullidAtributo.length == 9 && ir != 'não') {
        window.location.href = 'https://' + $('#dominio').text() + '/' + fullidAtributo;
    }
    return;
}

function perguntasDoProduto() {
    $.ajax({
        url: $('#caminhoBase').text() + '/api/',
        type: 'POST',
        async: true,
        data: 'metodo=perguntasDoProduto',
        dataType: 'html',
        success: function (resposta) {
            $('#perguntasDoProduto').html(resposta);
        }
    });
    return;
}

function perguntar() {
    pergunta = outputFilter($('#pergunta').val());
    if (pergunta.length == 0) {
        return;
    }
    loading('loading2');
    $.ajax({
        url: $('#caminhoBase').text() + '/api/',
        type: 'POST',
        async: true,
        data: 'metodo=perguntar&pergunta=' + pergunta,
        dataType: 'html',
        success: function (resposta) {
            $('#perguntaFeita').fadeIn(150).css('display', 'flex');
            perguntasDoProduto();
            $('#pergunta').val('');
            setTimeout(function () {
                loading('loading2');
                setTimeout(function () {
                    $('#perguntaFeita').fadeOut(150);
                }, 4000);
            }, 1000);

        }
    });
    return;
}

function comoPerguntar() {
    $('#pergunta').focus();
    return;
}

function fecharPerguntaFeita() {
    $('#perguntaFeita').fadeOut(150);
    return;
}
window.addEventListener('load', () => {
    set_cookie('pagina_atual', 'produto');
    let pathname = window.location.pathname;
    pathname = pathname.split('/');
    set_cookie('caminho_atual', pathname[1]);

    set_cookie('produto_checkout_externo', JSON.stringify({
        ativo: 0,
        link: '',
        acionamento: '',
        nova_aba: 0
    }));
    set_cookie('pular_login', 0);
    set_cookie('contabilizar_onlines', 0);

    $("#imagens-do-produto").owlCarousel({
        navigation: true,
        slideSpeed: 300,
        paginationSpeed: 400,
        singleItem: true,
        items: 1
    });


    $('.quantidadePersonalizada').keyup(function () {
        q = $('.quantidadePersonalizada').val();
        qt = $('#quantidadeTotal').text();
        if (parseInt(q) > parseInt(qt)) {
            $('.quantidadePersonalizada').val(qt);
        }
    });
});