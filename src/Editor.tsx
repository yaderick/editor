import React, { useEffect, useRef, forwardRef, useLayoutEffect } from 'react'
import "quill-css/quill.snow.css";

import Quill, {Module,Parchment,  Range} from 'quill';
// import Parchment from 'Parchment'

console.log(Parchment, '--');

import CleanBlot from './components/blots/CleanBlot';
import UndoBlot from './components/blots/Undo';
// Quill.register('modules/clean', CleanBlot);
Quill.register('modules/undo', UndoBlot);







interface EditorIprops {
 

}
const RichEditor: React.FC<EditorIprops> = () => {
    class Anemail {
      static defaultConif ={
        a: 1
      }
      static j () {
        console.log('我是静态方法2', this);
        
      }

      public name = '我是类'
      private age = 23

      constructor() {
        
      }
      getName() {
        return this.name
      }
      setName(name) {
        this.name = name
      }
      test() {
        console.log('我是实例方法', this);
        console.log('测试默认值', this.name, this.age);
      }


    }

    class Dog extends Anemail {
      constructor() {
        super()
        this.test()
      }
      static h () {
        super.j()
        console.log('我是静态方法1', this);
      }
      ha() {
        this.h() // 实例方法中不能调用静态方法
      }
    }
    const dog = new Dog()
    const cat = new Dog()
    console.log(dog, cat)

    useEffect(() => {
      
      const quill = new Quill('#editor',{
        theme: 'snow',
        modules: {
            // clean: {
            //     icon: '<svg height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg"><path d="m4.32708124 14h4.04442459l2.20143507-2.4449414-5.9432211-5.35130032-3.37506669 3.75166833c-.16386677.18215159-.25400941.41881029-.25284755.66382079.00115012.242535.10440665.4733676.28444423.6358823zm11.67291876 0v1h-12.06239992l-3.3403499-3.0076646c-.3801775-.3423133-.59725018-.8831597-.59725018-1.3773971 0-.4942375.18300094-.97097124.51371035-1.33826125l8.0548414-8.94580766 7.43144825 6.69130607-6.28286144 6.97782454z" fill="#71757F" fill-rule="evenodd"/></svg>'
            // },
            undo: {
              icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>'
            },
        
        }
      });

      console.log(quill)
      quill.insertText(0, 'Hello', 'link', 'https://world.com');
      const pNode = document.querySelector('p');
      const linkNode = document.querySelector('a');
      const linkBlot = Quill.find(linkNode);
      const pBlot = Quill.find(pNode);
      console.log(linkNode, linkBlot, pNode,pBlot, '-----');
      

      // Find Quill instance from a blot
      // console.log(Quill.find(linkBlot.scroll.domNode.parentElement));


      quill.on(Quill.events.TEXT_CHANGE, (delta, oldDelta, eventTrigger: string) => {
        
        
      });

      // quill.on(Quill.events.SELECTION_CHANGE, (...args) => {
      //   onSelectionChangeRef.current?.(...args);
      // });

    }, [])

    return (
        <div id='editor'>
          <p>你好，这是一个html</p>
          <p>你好，这是二个html</p>
          <p>你好，这是三个html</p>
        </div> 
    )
}

export default RichEditor
