const beard = require('./beard');
const beardInstance = beard({
  'page': '{{extend layout}}and im the page {{block main}}hello Im the main content{{endblock}}{{block sidebar}}hello im the sidebar{{endblock}}',
  'layout': 'im the layout {{sidebar}} - {{main}} {{view}} footer',
  'partials/another-layer-deep': 'and im another layer deep',
  'partials/appeal': '{{campaign.appeal}}',
  'partials/offer': '{{campaign.offer}} {{include partials/another-layer-deep}}',
  'conditional-with-nested-partials': `
  {{if campaign.appeal}}
  {{include partials/appeal}}
  {{else}}
  {{include partials/offer}}
  {{end}}`
});

const html = beardInstance.render('{{include page}}', {});
console.log(html);

const anotherBeardInstance = beard({
  'joe': 'Hi im joe'
});

const anotherHtml = anotherBeardInstance.render('{{include joe}}', {});
console.log('\n');
console.log(anotherHtml);
