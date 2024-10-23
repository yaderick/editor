import Scope from '../scope.js';
import type { Blot, Leaf, Root } from './abstract/blot.js';
import LeafBlot from './abstract/leaf.js';

class TextBlot extends LeafBlot implements Leaf {
  public static readonly blotName = 'text';
  public static scope = Scope.INLINE_BLOT;

  public static create(value: string): Text {
    return document.createTextNode(value);
  }

  public static value(domNode: Text): string {
    return domNode.data;
  }

  public domNode!: Text;
  protected text: string;

  constructor(scroll: Root, node: Node) {
    super(scroll, node);
    // 取自#text node 的 data值
    this.text = this.statics.value(this.domNode); //  statics 来自顶层shadow.ts 的方法
  }

  public deleteAt(index: number, length: number): void {
    this.domNode.data = this.text =
      this.text.slice(0, index) + this.text.slice(index + length);
  }

  public index(node: Node, offset: number): number {
    if (this.domNode === node) {
      return offset;
    }
    return -1;
  }

  public insertAt(index: number, value: string, def?: any): void {
    if (def == null) {
      this.text = this.text.slice(0, index) + value + this.text.slice(index);
      this.domNode.data = this.text;
    } else {
      super.insertAt(index, value, def);
    }
  }

  public length(): number {
    return this.text.length;
  }

  public optimize(context: { [key: string]: any }): void {
    super.optimize(context);
    this.text = this.statics.value(this.domNode);
    if (this.text.length === 0) {
      this.remove();
    } else if (this.next instanceof TextBlot && this.next.prev === this) { // 紧凑格式 #123 #456 合并为一个节点 
      this.insertAt(this.length(), (this.next as TextBlot).value());
      this.next.remove();
    }
  }

  public position(index: number, _inclusive = false): [Node, number] {
    return [this.domNode, index];
  }
  /**
   * 将当前的文本节点（TextBlot）在指定的索引位置进行分割，并返回分割后的新文本节点。
   * force 是否分割标识
   * */ 
  /**
   * splitText(offset) 将原来的Text 节点分为两个TextNode, 
   * 1、原来的变为截取后的 eg Hello, world! => Hello,
   * 2、截取后的返回新值 eg world!新的文本节点
   * <div id='example'>Hello, world!</div>
      var div = document.getElementById('example');
      // 获取文本节点
      var textNode = div.firstChild; // div 的第一个子节点是文本节点
      // 在指定位置分割文本节点
      var newTextNode = textNode.splitText(7);
      // 现在 textNode 包含 "Hello, "，而 newTextNode 包含 "world!"
      console.log(textNode.nodeValue); // "Hello, "
      console.log(newTextNode.nodeValue); // "world!"
  */
  public split(index: number, force = false): Blot | null {
    if (!force) {
      if (index === 0) { // 不分割
        return this;
      }
      if (index === this.length()) { // 不切割直接返回下个节点
        return this.next;
      }
    }
    // 分割后新建的blot
    const after = this.scroll.create(this.domNode.splitText(index)); // 实例化text blot
    //  将新建的blot插入 到parchment 中
    this.parent.insertBefore(after, this.next || undefined);
    // this.domNode.splitText后同步更新textblot的值 
    this.text = this.statics.value(this.domNode);
    return after;
  }

  public update(
    mutations: MutationRecord[],
    _context: { [key: string]: any },
  ): void {
    if (
      mutations.some((mutation) => {
        return (
          mutation.type === 'characterData' && mutation.target === this.domNode
        );
      })
    ) {
      this.text = this.statics.value(this.domNode);
    }
  }

  public value(): string {
    return this.text;
  }
}

export default TextBlot;
