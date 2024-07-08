基础知识：

类包括成员和方法

成员和方法分为静态和实例两类: 
eg: 静态 static 变量名

静态成员和方法可以被继承 & 必须通过类名调用,即不能通过实例化调用
eg: A.test() 或者 super.test()

## 入口文件  
quilljs
三件事：
1、注册：
Quill.register 
13种 attributors 属性 eg: class/font, style/font 
2、注册 
Quill.register 
21中 formats 格式；
3种 modules；eg:Syntax、Table、Toolbar
2种 themes 主题
5种UI
3、导出变量 export {
Module, Parchment, Range,
Quill as default} 这些变量都来自 corejs

## corejs
两件事
1、注册： 
Quill.register 
 9种blot 来自blots/
 6中modules； eg: Clipboard、History、Keyboard、Uploader、Input、UINode  来自 modules/
2、导出变量 export {
 Delta, Op, OpIterator, AttributeMap,  // 并未对外暴露
 Module, Parchment, Range, Quill as default} 这些变量都来自 core/quilljs

### core/quilljs


### modules/
### blots/