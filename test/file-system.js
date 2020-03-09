const { expect } = require('chai');
const beard = require('../lib/index');

describe('File System', function() {
  it('renders files from the file system', function() {
    const engine = beard({
      root: __dirname
    });
    expect(engine.render('templates/view').replace(/\s+/g, ' ')).to.equal('header | the view click | footer ');
  });
});
