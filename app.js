/* Fluxo da pesquisa. Textos e perguntas ficam em conteudo.js; endereço do servidor em config.js. */
(function () {
  'use strict';
  var CFG = window.CONFIG, C = window.CONTEUDO;
  var app = document.getElementById('app');
  var barra = document.getElementById('progresso-barra');
  var PARAMS = new URLSearchParams(location.search);
  var TESTE = PARAMS.get('teste') === '1' ? 1 : 0;
  /* MODO DEMONSTRAÇÃO: liga sozinho enquanto a URL do servidor não estiver configurada, ou com ?demo=1.
     Nada é enviado nem gravado. ?cond=A, ?cond=B ou ?cond=N força a versão exibida. */
  var DEMO = PARAMS.get('demo') === '1' || !/^https:\/\/script\.google\.com\//.test(CFG.URL_SERVIDOR || '');
  var DEMO_COND = ['A', 'B', 'N'].indexOf(PARAMS.get('cond')) >= 0 ? PARAMS.get('cond') : null;
  var CHAVE = 'pesquisa_mpu_estado';
  var ORDEM = ['T00', 'T01', 'T02', 'T03', 'T04', 'SORTEIO', 'T05', 'T06', 'QUIZ', 'T08', 'T09', 'ENVIO', 'FIM'];
  var t0 = 0;

  // ---------------- estado (fica só nesta aba do navegador) ----------------
  function novoEstado() {
    return { pid: gerarPid(), passo: 'T00', iq: 0, cond: null, modo: null, itens: null, ordens: {},
             dados: { teste: TESTE, inicio_iso: new Date().toISOString(), recargas_estimulo: 0,
                      origem_link: (PARAMS.get('origem') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40),
                      repetido_aparelho: jaRespondeu() ? 1 : 0 } };
  }
  /* Marca neutra no aparelho depois do envio: só sinaliza repetição (não bloqueia, porque o celular pode ser compartilhado). */
  var CHAVE_FEITO = 'pq_c';
  function jaRespondeu() { try { return localStorage.getItem(CHAVE_FEITO) === '1'; } catch (e) { return false; } }
  function marcarRespondido() { try { localStorage.setItem(CHAVE_FEITO, '1'); } catch (e) { /* nada */ } }
  function salvar() { try { sessionStorage.setItem(CHAVE, JSON.stringify(E)); } catch (e) { /* modo privado restrito */ } }
  function carregar() { try { return JSON.parse(sessionStorage.getItem(CHAVE)); } catch (e) { return null; } }
  function gerarPid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var a = new Uint8Array(16); crypto.getRandomValues(a);
    var h = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  var E = carregar() || novoEstado();

  // ---------------- botão Sair rápido ----------------
  document.getElementById('sair').addEventListener('click', function () {
    try { sessionStorage.clear(); } catch (e) { /* nada */ }
    app.innerHTML = '';
    location.replace(CFG.SITE_SAIDA);
  });

  // ---------------- comunicação com o servidor ----------------
  function espera(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function respostaDemo(corpo) {
    if (corpo.acao === 'atribuir') {
      var cond = DEMO_COND || (Math.random() < 0.5 ? 'A' : 'B');
      var modo = (cond === 'N' || PARAMS.get('modo') === 'piloto') ? 'piloto' : 'principal';
      return { ok: true, status: 'ok', modo: modo, condicao: cond, posicao: 0,
               estrato: modo === 'piloto' ? 'unico' : (Number(corpo.escolaridade_idx) <= 3 ? 'baixa' : 'alta') + '_' + (corpo.uf === 'MA' ? 'MA' : 'fora') };
    }
    return { ok: true, status: 'gravado' };
  }
  function chamar(corpo, tentativas) {
    if (DEMO) return espera(400).then(function () { return respostaDemo(corpo); });
    tentativas = tentativas || 3;
    var i = 0;
    function tentar() {
      return fetch(CFG.URL_SERVIDOR, { method: 'POST', body: JSON.stringify(corpo), redirect: 'follow' })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && (j.ok || (j.erro && !/ocupado/.test(j.erro)))) return j;
          throw new Error('servidor ocupado');
        })
        .catch(function () {
          i++;
          if (i >= tentativas) return null;
          return espera(1500 * i).then(tentar);
        });
    }
    return tentar();
  }
  function evento(tela, detalhe) {
    if (DEMO) return;
    try {
      fetch(CFG.URL_SERVIDOR, { method: 'POST', mode: 'no-cors', keepalive: true,
        body: JSON.stringify({ acao: 'evento', pid: E.pid, tela: tela, detalhe: detalhe || '', teste: TESTE }) });
    } catch (e) { /* evento é opcional */ }
  }

  // ---------------- utilitários de interface ----------------
  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'texto') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) { if (f) n.appendChild(f); });
    return n;
  }
  function paragrafos(lista) { return lista.map(function (t) { return el('p', { texto: t }); }); }
  function botao(rotulo, acao, desativado) {
    var b = el('button', { type: 'button', 'class': 'primario', texto: rotulo, onclick: acao });
    b.disabled = !!desativado;
    return b;
  }
  /** Pergunta de escolha única com alternativas grandes. aoMudar recebe o índice escolhido. */
  function escolha(nome, enunciado, opcoes, aoMudar, ajuda) {
    var fs = el('fieldset', { 'class': 'pergunta' }, [el('legend', { texto: enunciado })]);
    if (ajuda) fs.appendChild(el('p', { 'class': 'ajuda', texto: ajuda }));
    opcoes.forEach(function (op, i) {
      var inp = el('input', { type: 'radio', name: nome, value: String(i) });
      inp.addEventListener('change', function () {
        Array.prototype.forEach.call(fs.querySelectorAll('label'), function (l) { l.classList.remove('marcada'); });
        lab.classList.add('marcada');
        aoMudar(i);
      });
      var lab = el('label', { 'class': 'opcao' }, [inp, el('span', { texto: op })]);
      fs.appendChild(lab);
    });
    return fs;
  }
  function apoio() {
    var uf = E && E.dados ? E.dados.uf : undefined;
    var html = C.APOIO_HTML + ((uf === 'MA' || !uf) ? C.APOIO_MA_HTML : C.APOIO_OUTROS_HTML);
    return el('div', { 'class': 'apoio', html: html });
  }
  function duracao() { return Math.round(performance.now() - t0); }
  function registrarTempo(tela) { E.dados['t_' + tela + '_ms'] = duracao(); }
  function embaralhar(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var r = new Uint32Array(1); crypto.getRandomValues(r);
      var j = r[0] % (i + 1); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function aparelho() {
    var ua = navigator.userAgent;
    if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
    if (/Mobi|Android|iPhone/i.test(ua)) return 'celular';
    return 'computador';
  }

  // ---------------- navegação ----------------
  function ir(passo) { E.passo = passo; salvar(); render(); }
  function render() {
    window.scrollTo(0, 0);
    app.innerHTML = '';
    t0 = performance.now();
    var pos = ORDEM.indexOf(E.passo);
    var pct = pos < 0 ? 100 : Math.round(100 * pos / (ORDEM.length - 1));
    if (E.passo === 'QUIZ' && E.itens) pct = Math.round(100 * (8 + E.iq / E.itens.length) / (ORDEM.length - 1));
    barra.style.width = pct + '%';
    evento(E.passo === 'QUIZ' ? 'QUIZ_' + (E.iq + 1) : E.passo);
    TELAS[E.passo]();
  }

  // ---------------- telas ----------------
  var TELAS = {
    T00: function () {
      if (C.APRESENTACAO_HTML) {
        app.appendChild(el('div', { 'class': 'apresentacao', html: C.APRESENTACAO_HTML }));
      } else {
        app.appendChild(el('h1', { texto: C.TITULO }));
        paragrafos(C.APRESENTACAO).forEach(function (p) { app.appendChild(p); });
      }
      app.appendChild(botao(C.BOTAO_INICIO || 'Começar', function () { registrarTempo('T00'); ir('T01'); }));
    },
    T01: function () {
      var resp = null, b;
      app.appendChild(el('h2', { texto: 'Termo de consentimento' }));
      app.appendChild(el('div', { 'class': 'tcle', html: C.TCLE_HTML }));
      app.appendChild(escolha('consent', 'Você aceita participar?', ['Sim, aceito participar', 'Não aceito'],
        function (i) { resp = i; b.disabled = false; }));
      b = botao('Continuar', function () {
        registrarTempo('T01');
        if (resp === 0) { E.dados.consentimento = 1; ir('T02'); }
        else { evento('recusa'); ir('FIM_RECUSA'); }
      }, true);
      app.appendChild(b);
    },
    T02: function () {
      var UFS = [['AC','Acre'],['AL','Alagoas'],['AP','Amapá'],['AM','Amazonas'],['BA','Bahia'],['CE','Ceará'],['DF','Distrito Federal'],['ES','Espírito Santo'],['GO','Goiás'],['MA','Maranhão'],['MT','Mato Grosso'],['MS','Mato Grosso do Sul'],['MG','Minas Gerais'],['PA','Pará'],['PB','Paraíba'],['PR','Paraná'],['PE','Pernambuco'],['PI','Piauí'],['RJ','Rio de Janeiro'],['RN','Rio Grande do Norte'],['RS','Rio Grande do Sul'],['RO','Rondônia'],['RR','Roraima'],['SC','Santa Catarina'],['SP','São Paulo'],['SE','Sergipe'],['TO','Tocantins']];
      var r = { mulher: null }, b;
      var idade = el('input', { type: 'number', inputmode: 'numeric', min: '0', max: '120', id: 'idade', 'class': 'numero' });
      var uf = el('select', { id: 'uf', 'class': 'lista' }, [el('option', { value: '', texto: 'Escolha o estado' })]
        .concat(UFS.map(function (u) { return el('option', { value: u[0], texto: u[1] }); }))
        .concat([el('option', { value: 'EX', texto: 'Não moro no Brasil' })]));
      /* Campo invisível para pessoas; robôs costumam preenchê-lo. */
      var mel = el('input', { type: 'text', id: 'website', name: 'website', tabindex: '-1', autocomplete: 'off', 'class': 'campo-oculto', 'aria-hidden': 'true' });
      function checar() { b.disabled = !(r.mulher !== null && idade.value !== '' && uf.value !== ''); }
      idade.addEventListener('input', checar); uf.addEventListener('change', checar);
      app.appendChild(el('h2', { texto: 'Algumas perguntas iniciais' }));
      app.appendChild(escolha('mulher', 'Você é mulher?', ['Sim', 'Não'], function (i) { r.mulher = i; checar(); }, C.AJUDA_MULHER || ''));
      app.appendChild(el('fieldset', { 'class': 'pergunta' }, [el('legend', { texto: 'Qual é a sua idade, em anos completos?' }), idade]));
      app.appendChild(el('fieldset', { 'class': 'pergunta' }, [el('legend', { texto: 'Em qual estado você mora?' }), uf]));
      app.appendChild(mel);
      var aviso = el('p', { 'class': 'aviso' });
      app.appendChild(aviso);
      b = botao('Continuar', function () {
        var n = Number(idade.value);
        if (!(n >= 1 && n <= 110)) { aviso.textContent = 'Confira a idade digitada.'; return; }
        registrarTempo('T02');
        E.dados.idade = n;
        E.dados.uf = uf.value;
        E.dados.reside_ma = uf.value === 'MA' ? 1 : 0;
        E.dados.honeypot = mel.value ? 1 : 0;
        var motivo = r.mulher !== 0 ? 'nao_mulher' : (n < 18 ? 'menor_18' : (uf.value === 'EX' ? 'fora_brasil' : ''));
        if (motivo) { evento('triagem_encerrada', motivo); ir('FIM_TRIAGEM'); return; }
        ir('T03');
      }, true);
      app.appendChild(b);
    },
    T03: function () {
      var r = { esc: null, a1: null }, b;
      var A1 = ['Verde', 'Azul', 'Vermelho', 'Amarelo'];
      function checar() { b.disabled = !(r.esc !== null && r.a1 !== null); }
      app.appendChild(escolha('esc', 'Até que série você estudou? Marque o nível mais alto que você concluiu.', C.ESCOLARIDADE,
        function (i) { r.esc = i; checar(); }));
      app.appendChild(escolha('a1', 'Para sabermos que você está lendo com atenção, marque a cor AZUL nesta pergunta.', A1,
        function (i) { r.a1 = i; checar(); }));
      b = botao('Continuar', function () {
        registrarTempo('T03');
        E.dados.escolaridade_idx = r.esc;
        E.dados.escolaridade = C.ESCOLARIDADE[r.esc];
        E.dados.atencao1 = A1[r.a1];
        ir('T04');
      }, true);
      app.appendChild(b);
    },
    T04: function () {
      var v = null, b;
      app.appendChild(el('h2', { texto: 'Como você está agora' }));
      app.appendChild(el('p', { texto: 'Neste momento, como você se sente? Toque ou arraste na barra.' }));
      var mostrador = el('div', { 'class': 'mostrador', 'aria-live': 'polite' }, [el('span', { 'class': 'mostrador-dica', texto: 'Escolha um ponto na barra' })]);
      var barra = el('input', { type: 'range', min: '0', max: '10', step: '1', value: '5', id: 'vas',
                                'class': 'deslizante intocado', 'aria-label': 'Estresse agora, de 0 (completamente calma) a 10 (extremamente estressada)' });
      function atualizar() {
        v = Number(barra.value);
        barra.classList.remove('intocado');
        mostrador.innerHTML = '';
        mostrador.appendChild(el('span', { 'class': 'mostrador-num', texto: String(v) }));
        mostrador.appendChild(el('span', { 'class': 'mostrador-de', texto: ' de 10' }));
        b.disabled = false;
      }
      ['input', 'change', 'pointerup'].forEach(function (ev) { barra.addEventListener(ev, atualizar); });
      app.appendChild(mostrador);
      app.appendChild(barra);
      app.appendChild(el('div', { 'class': 'ancoras' }, [el('span', { texto: '0 = Completamente calma' }), el('span', { texto: '10 = Extremamente estressada' })]));
      b = botao('Continuar', function () { registrarTempo('T04'); E.dados.vas_estresse = v; ir('SORTEIO'); }, true);
      app.appendChild(b);
    },
    SORTEIO: function () {
      app.appendChild(el('p', { 'class': 'carregando', texto: 'Preparando a próxima etapa...' }));
      chamar({ acao: 'atribuir', pid: E.pid, escolaridade_idx: E.dados.escolaridade_idx, uf: E.dados.uf }).then(function (j) {
        if (!j || !j.ok) { telaErro('SORTEIO'); return; }
        if (j.status === 'encerrado') { evento('cota_encerrada'); ir('FIM_COTA'); return; }
        E.cond = j.condicao; E.modo = j.modo;
        E.dados.estrato_cliente = j.estrato;
        E.itens = (E.modo === 'piloto' ? CFG.ITENS_PILOTO : CFG.ITENS_PRINCIPAL).slice();
        E.itens.forEach(function (id) { E.ordens[id] = embaralhar([0, 1, 2]); });
        E.dados.itens_aplicados = E.itens.join(' ');
        ir('T05');
      });
    },
    T05: function () {
      var semLeitura = E.cond === 'N';
      app.appendChild(el('h2', { texto: semLeitura ? 'Perguntas' : 'Leitura' }));
      paragrafos(semLeitura ? C.INSTRUCAO_SEM_LEITURA : C.INSTRUCAO_LEITURA).forEach(function (p) { app.appendChild(p); });
      app.appendChild(botao(semLeitura ? 'Começar as perguntas' : 'Abrir a decisão', function () {
        registrarTempo('T05'); ir(semLeitura ? 'QUIZ' : 'T06');
      }));
    },
    T06: function () {
      if (E.dados.t_estimulo_ms) { ir('QUIZ'); return; }   // não volta ao texto
      E.dados.recargas_estimulo = (E.dados.recargas_estimulo || 0) + 1;
      var visivel = { resumo: 0, original: 0 }, inicio = {}, scrollMax = 0;
      var doc = el('div', { 'class': 'documento' });
      if (E.cond === 'B') {
        doc.appendChild(el('div', { 'class': 'aviso-resumo', role: 'note' }, [
          el('span', { 'class': 'aviso-resumo-icone', 'aria-hidden': 'true', texto: 'i' }),
          el('span', { texto: C.AVISO_RESUMO })
        ]));
      }
      doc.appendChild(el('section', { id: 'sec-original', 'class': 'original', html: C.ORIGINAL_HTML }));
      if (E.cond === 'B') {
        var img = el('img', { src: C.RESUMO_IMAGEM, alt: C.RESUMO_ALT, 'class': 'resumo-img' });
        img.addEventListener('error', function () {
          img.replaceWith(el('div', { 'class': 'pendente', texto: '[RESUMO EM VISUAL LAW: salvar a imagem em ' + C.RESUMO_IMAGEM + ']' }));
        });
        doc.appendChild(el('h3', { 'class': 'rotulo-resumo', texto: C.RESUMO_TITULO }));
        doc.appendChild(el('section', { id: 'sec-resumo', 'class': 'resumo' }, [img,
          el('p', { 'class': 'ajuda', texto: 'No celular, você pode ampliar a imagem com dois dedos.' })]));
      }
      app.appendChild(doc);
      var b = botao('Terminei de ler', function () {
        if (!b.dataset.confirmar) {
          b.dataset.confirmar = '1';
          b.textContent = 'Confirmar: ir para as perguntas (não será possível voltar)';
          return;
        }
        Object.keys(inicio).forEach(function (k) { if (inicio[k]) visivel[k] += performance.now() - inicio[k]; });
        if (obs) obs.disconnect();
        window.removeEventListener('scroll', aoRolar);
        E.dados.t_estimulo_ms = duracao();
        E.dados.t_resumo_visivel_ms = E.cond === 'B' ? Math.round(visivel.resumo) : '';
        E.dados.t_original_visivel_ms = Math.round(visivel.original);
        E.dados.rolagem_max_pct = scrollMax;
        ir('QUIZ');
      });
      app.appendChild(b);
      function aoRolar() {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        var p = h > 0 ? Math.round(100 * window.scrollY / h) : 100;
        if (p > scrollMax) scrollMax = p;
      }
      window.addEventListener('scroll', aoRolar, { passive: true });
      aoRolar();
      var obs = null;
      if ('IntersectionObserver' in window) {
        obs = new IntersectionObserver(function (ents) {
          ents.forEach(function (en) {
            var k = en.target.id === 'sec-resumo' ? 'resumo' : 'original';
            if (en.isIntersecting && !inicio[k]) inicio[k] = performance.now();
            if (!en.isIntersecting && inicio[k]) { visivel[k] += performance.now() - inicio[k]; inicio[k] = 0; }
          });
        }, { threshold: 0.15 });
        Array.prototype.forEach.call(doc.querySelectorAll('section'), function (s) { obs.observe(s); });
      }
    },
    QUIZ: function () {
      var id = E.itens[E.iq];
      var q = C.QUESTOES.filter(function (x) { return x.id === id; })[0];
      var ordem = E.ordens[id], escolhido = null, b;
      var rotulos = ordem.map(function (k) { return q.opcoes[k]; }).concat(['Não sei']);
      app.appendChild(el('p', { 'class': 'contador', texto: 'Pergunta ' + (E.iq + 1) + ' de ' + E.itens.length }));
      app.appendChild(escolha(id, q.texto, rotulos, function (i) { escolhido = i; b.disabled = false; }));
      b = botao('Continuar', function () {
        var original = escolhido < 3 ? ordem[escolhido] : -1;   // -1 = Não sei
        E.dados[id + '_resp'] = rotulos[escolhido];
        E.dados[id + '_acerto'] = original === q.correta ? 1 : 0;
        E.dados[id + '_ordem'] = ordem.join('');
        E.dados[id + '_t_ms'] = duracao();
        E.iq++;
        if (E.iq < E.itens.length) { ir('QUIZ'); return; }
        var soma = 0;
        E.itens.forEach(function (k) { soma += E.dados[k + '_acerto']; });
        E.dados.acertos_total = soma;
        E.dados.n_itens = E.itens.length;
        ir('T08');
      }, true);
      app.appendChild(b);
    },
    T08: function () {
      var v = null, b;
      var perg = E.cond === 'N' ? C.PAAS_PERGUNTA_SEM_LEITURA : C.PAAS_PERGUNTA;
      var rot = C.PAAS.map(function (t, i) { return (i + 1) + ' - ' + t; });
      app.appendChild(escolha('paas', perg, rot, function (i) { v = i + 1; b.disabled = false; }));
      b = botao('Continuar', function () { registrarTempo('T08'); E.dados.esforco_paas = v; ir('T09'); }, true);
      app.appendChild(b);
    },
    T09: function () {
      var P = [
        ['cor_raca', 'Qual é a sua cor ou raça?', ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Prefiro não responder']],
        ['municipio_tipo', 'Onde você mora?', ['Na capital do meu estado ou na região metropolitana', 'Em outra cidade do meu estado']],
        ['exp_mpu', 'Você tem ou já teve uma medida protetiva?', ['Sim, tenho agora', 'Sim, já tive no passado', 'Não', 'Prefiro não responder']],
        ['leu_decisao', 'Antes desta pesquisa, você já tinha lido alguma decisão da Justiça?', ['Sim', 'Não', 'Não lembro']],
        ['como_soube', 'Como você ficou sabendo desta pesquisa?', ['Por uma amiga, parente ou conhecida', 'Por mensagem ou grupo de WhatsApp', 'Pelo Instagram ou outra rede social', 'Por uma instituição (CRAS, Casa da Mulher, delegacia, universidade ou outra)', 'De outro jeito']]
      ];
      var r = {}, b;
      app.appendChild(el('h2', { texto: 'Para terminar, um pouco sobre você' }));
      P.forEach(function (p) {
        app.appendChild(escolha(p[0], p[1], p[2], function (i) {
          r[p[0]] = p[2][i];
          b.disabled = Object.keys(r).length < P.length;
        }));
      });
      b = botao('Enviar respostas', function () {
        registrarTempo('T09');
        Object.keys(r).forEach(function (k) { E.dados[k] = r[k]; });
        ir('ENVIO');
      }, true);
      app.appendChild(b);
    },
    ENVIO: function () {
      app.appendChild(el('p', { 'class': 'carregando', texto: 'Enviando suas respostas...' }));
      E.dados.fim_iso = new Date().toISOString();
      E.dados.aparelho = aparelho();
      E.dados.largura_tela = window.screen ? window.screen.width : '';
      chamar({ acao: 'enviar', pid: E.pid, dados: E.dados }).then(function (j) {
        if (!j || !j.ok) { telaErro('ENVIO'); return; }
        evento('fim');
        marcarRespondido();
        E = { passo: 'FIM', pid: E.pid, dados: { uf: E.dados.uf } };   // descarta as respostas do navegador (mantém só a UF para os contatos)
        salvar(); render();
      });
    },
    FIM: function () {
      app.appendChild(el('h2', { texto: C.ENCERRAMENTO[0] }));
      paragrafos(C.ENCERRAMENTO.slice(1)).forEach(function (p) { app.appendChild(p); });
      app.appendChild(apoio());
      app.appendChild(el('div', { 'class': 'logos' }, [
        el('img', { src: 'img/logo_ppga_unoesc.png', alt: 'PPGA Unoesc: Programa de Pós-graduação em Administração' }),
        el('img', { src: 'img/logo_ladec.png', alt: 'LaDEC: Laboratório de Decisão, Estratégia e Comportamento' })
      ]));
    },
    FIM_RECUSA: function () { fimSimples('Tudo bem. Obrigada pelo seu tempo.'); },
    FIM_TRIAGEM: function () { fimSimples(C.ENCERRADO_TRIAGEM); },
    FIM_COTA: function () { fimSimples(C.ENCERRADO_COTA); }
  };
  function fimSimples(texto) {
    app.appendChild(el('p', { texto: texto }));
    app.appendChild(apoio());
  }
  function telaErro(passo) {
    app.innerHTML = '';
    app.appendChild(el('p', { texto: 'Não conseguimos falar com o servidor. Confira sua internet e toque em "Tentar de novo". Suas respostas estão guardadas nesta página.' }));
    app.appendChild(botao('Tentar de novo', function () { ir(passo); }));
    app.appendChild(apoio());
  }

  if (DEMO) {
    document.body.classList.add('modo-demo');
    var faixa = el('div', { 'class': 'demo' }, [
      el('span', { texto: 'MODO DEMONSTRAÇÃO: nenhuma resposta é gravada.' + (DEMO_COND ? ' Versão ' + DEMO_COND + '.' : '') }),
      el('button', { type: 'button', texto: 'Recomeçar', onclick: function () {
        try { sessionStorage.removeItem(CHAVE); } catch (e) { /* nada */ }
        location.reload();
      } })
    ]);
    document.body.insertBefore(faixa, document.body.firstChild);
  }
  if (!TELAS[E.passo]) E = novoEstado();
  render();
})();
