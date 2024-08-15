import { EventEmitter } from 'eventemitter3';
import instances from './instances.js';
import logger from './logger.js';

const debug = logger('quill:events');
// 前三个在selection.ts 中添加； ’click‘ 是在主题Base.ts中添加
const EVENTS = ['selectionchange', 'mousedown', 'mouseup', 'click'];


/**
 * 事件系统，给document 绑定 mousedown -> selectionchange -> mouseup -> click
 * 
 * selectionchange  触发条件： 1、光标位置有变化 或者 2、选区发生变化才会触发。
 * 例如 1测试文字 触发一次 ； 再在1处点击不会触发selectionchange 只会触发其他点击事件
 * 1测试文字 -> 测1试文字 会触发
 * */ 
EVENTS.forEach((eventName) => {
  document.addEventListener(eventName, (...args) => {
    console.log(eventName, 'eventName');
    Array.from(document.querySelectorAll('.ql-container')).forEach((node) => {
      const quill = instances.get(node);
      if (quill && quill.emitter) {
        quill.emitter.handleDOM(...args);
      }
    });
  });
});

class Emitter extends EventEmitter<string> {
  static events = {
    
    EDITOR_CHANGE: 'editor-change',

    SCROLL_BEFORE_UPDATE: 'scroll-before-update',
    SCROLL_BLOT_MOUNT: 'scroll-blot-mount',
    SCROLL_BLOT_UNMOUNT: 'scroll-blot-unmount',

    SCROLL_OPTIMIZE: 'scroll-optimize',

    SCROLL_UPDATE: 'scroll-update',

    SCROLL_EMBED_UPDATE: 'scroll-embed-update',

    SELECTION_CHANGE: 'selection-change',

    TEXT_CHANGE: 'text-change',

    COMPOSITION_BEFORE_START: 'composition-before-start',
    COMPOSITION_START: 'composition-start',
    COMPOSITION_BEFORE_END: 'composition-before-end',
    COMPOSITION_END: 'composition-end',
  } as const;

  static sources = {
    API: 'api',
    SILENT: 'silent',
    USER: 'user',
  } as const;

  protected domListeners: Record<string, { node: Node; handler: Function }[]>;

  constructor() {
    super();
    /**
     * 'selectionchange', selection.ts 给document 注册
     *  'mousedown', selection.ts 给document.body 注册
     *  'mouseup',  selection.ts 给document.body 注册
     *  'click'  themes/base.ts 给document.body 注册
     *   仅此4种
     * */ 
    this.domListeners = {};
    this.on('error', debug.error);
  }

  emit(...args: unknown[]): boolean {
    debug.log.call(debug, ...args);
    // @ts-expect-error
    return super.emit(...args);
  }
  // 执行listenDOM事件
  handleDOM(event: Event, ...args: unknown[]) {
    (this.domListeners[event.type] || []).forEach(({ node, handler }) => {
      if (event.target === node || node.contains(event.target as Node)) {
        handler(event, ...args);
      }
    });
  }
  // 注册handleDOM 事件
  listenDOM(eventName: string, node: Node, handler: EventListener) {
    if (!this.domListeners[eventName]) {
      this.domListeners[eventName] = [];
    }
    this.domListeners[eventName].push({ node, handler });
  }
}

export type EmitterSource =
  (typeof Emitter.sources)[keyof typeof Emitter.sources];

export default Emitter;
