/* CONFIGURAÇÃO DA PÁGINA. É o único arquivo que precisa ser editado na implantação. */
window.CONFIG = {
  /* URL do app da Web do Apps Script (termina em /exec). Ver README, passo 3. */
  URL_SERVIDOR: 'COLE_AQUI_A_URL_DO_APPS_SCRIPT',

  /* Perguntas de compreensão em cada modo. O modo (piloto ou principal) vem do servidor. */
  ITENS_PILOTO: ['Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07', 'Q08', 'Q09', 'Q10', 'Q11', 'Q12', 'Q13', 'Q14', 'Q15'],
  /* Seleção provisória; definir após o piloto e registrar no pré-registro. */
  ITENS_PRINCIPAL: ['Q01', 'Q02', 'Q04', 'Q08', 'Q11', 'Q12', 'Q14'],

  MINUTOS_ESTIMADOS: '15 a 20',

  /* Página neutra aberta pelo botão "Sair rápido". */
  SITE_SAIDA: 'https://www.google.com/search?q=previs%C3%A3o+do+tempo'
};
