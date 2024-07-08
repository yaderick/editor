import Quill from 'quill';
import React from 'react';
import * as ReactDOM from 'react-dom/client'
// const icons = Quill.import('ui/icons');
// icons.clean = '<svg height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg"><path d="m4.32708124 14h4.04442459l2.20143507-2.4449414-5.9432211-5.35130032-3.37506669 3.75166833c-.16386677.18215159-.25400941.41881029-.25284755.66382079.00115012.242535.10440665.4733676.28444423.6358823zm11.67291876 0v1h-12.06239992l-3.3403499-3.0076646c-.3801775-.3423133-.59725018-.8831597-.59725018-1.3773971 0-.4942375.18300094-.97097124.51371035-1.33826125l8.0548414-8.94580766 7.43144825 6.69130607-6.28286144 6.97782454z" fill="#293040" fill-rule="evenodd"/></svg>';

const BlockEmbed = Quill.import('blots/block/embed');
import { Tooltip } from 'antd';

class UndoBlot  {
  static blotName = 'undo';
  static tagName = 'div';

  constructor(quill, options) {
    this.quill = quill;
    this.options = options;
    this.toolbar = quill.getModule('toolbar')
    this.toolbar?.addHandler('undo', this.undoHandler.bind(this))
    const cleanButton = document.querySelector('.ql-undo')
    if (cleanButton) {
        const root = ReactDOM.createRoot(cleanButton!)
        const tooltipContent = (

            <div style={{textAlign: 'center'}}>
                <div >撤销</div>
                <div>Ctrl + Z</div>
            </div>
        );
    root.render(
        <Tooltip placement="top" title={tooltipContent} color={'#464d6e'}>
            <span style={{width: '100%', display: 'inline-block'}} dangerouslySetInnerHTML={{ __html: this.options.icon }} />
        </Tooltip>
    );
  }
    
  }
  undoHandler() {

    this.quill.history.undo();
  }

}

export default UndoBlot;
