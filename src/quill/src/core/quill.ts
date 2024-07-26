import { merge } from 'lodash-es';
import * as Parchment from 'parchment';
import type { Op } from 'quill-delta';
import Delta from 'quill-delta';
import type { BlockEmbed } from '../blots/block.js';
import type Block from '../blots/block.js';
import type Scroll from '../blots/scroll.js';
import type Clipboard from '../modules/clipboard.js';
import type History from '../modules/history.js';
import type Keyboard from '../modules/keyboard.js';
import type Uploader from '../modules/uploader.js';
import Editor from './editor.js';
import Emitter from './emitter.js';
import type { EmitterSource } from './emitter.js';
import instances from './instances.js';
import logger from './logger.js';
import type { DebugLevel } from './logger.js';
import Module from './module.js';
import Selection, { Range } from './selection.js';
import type { Bounds } from './selection.js';
import Composition from './composition.js';
import Theme from './theme.js';
import type { ThemeConstructor } from './theme.js';
import scrollRectIntoView from './utils/scrollRectIntoView.js';
import type { Rect } from './utils/scrollRectIntoView.js';
import createRegistryWithFormats from './utils/createRegistryWithFormats.js';

const debug = logger('quill');

const globalRegistry = new Parchment.Registry();
Parchment.ParentBlot.uiClass = 'ql-ui';

/**
 * Options for initializing a Quill instance
 */
export interface QuillOptions {
  theme?: string;
  debug?: DebugLevel | boolean;
  registry?: Parchment.Registry;
  /**
   * Whether to disable the editing
   * @default false
   */
  readOnly?: boolean;

  /**
   * Placeholder text to display when the editor is empty
   * @default ""
   */
  placeholder?: string;
  bounds?: HTMLElement | string | null;
  modules?: Record<string, unknown>;

  /**
   * A list of formats that are recognized and can exist within the editor contents.
   * `null` means all formats are allowed.
   * @default null
   */
  formats?: string[] | null;
}

/**
 * Similar to QuillOptions, but with all properties expanded to their default values,
 * and all selectors resolved to HTMLElements.
 */
export interface ExpandedQuillOptions
  extends Omit<QuillOptions, 'theme' | 'formats'> {
  theme: ThemeConstructor;
  registry: Parchment.Registry;
  container: HTMLElement;
  modules: Record<string, unknown>;
  bounds?: HTMLElement | null;
  readOnly: boolean;
}

class Quill {
  static DEFAULTS = {
    bounds: null,
    modules: {
      clipboard: true,
      keyboard: true,
      history: true,
      uploader: true,
    },
    placeholder: '',
    readOnly: false,
    registry: globalRegistry,
    theme: 'default',
  } satisfies Partial<QuillOptions>;
  static events = Emitter.events;
  static sources = Emitter.sources;
  static version = typeof QUILL_VERSION === 'undefined' ? 'dev' : QUILL_VERSION;

  static imports: Record<string, unknown> = {
    delta: Delta,
    parchment: Parchment,
    'core/module': Module,
    'core/theme': Theme,
  };

  static debug(limit: DebugLevel | boolean) {
    if (limit === true) {
      limit = 'log';
    }
    logger.level(limit);
  }

  static find(node: Node, bubble = false) {
    return instances.get(node) || globalRegistry.find(node, bubble);
  }

  static import(name: 'core/module'): typeof Module;
  static import(name: `themes/${string}`): typeof Theme;
  static import(name: 'parchment'): typeof Parchment;
  static import(name: 'delta'): typeof Delta;
  static import(name: string): unknown;
  static import(name: string) {
    if (this.imports[name] == null) {
      debug.error(`Cannot import ${name}. Are you sure it was registered?`);
    }
    return this.imports[name];
  }

  static register(
    targets: Record<
      string,
      | Parchment.RegistryDefinition
      | Record<string, unknown> // any objects
      | Theme
      | Module
      | Function // ES5 constructors
    >,
    overwrite?: boolean,
  ): void;
  static register(
    target: Parchment.RegistryDefinition,
    overwrite?: boolean,
  ): void;
  static register(path: string, target: any, overwrite?: boolean): void;
  static register(...args: any[]): void {
    if (typeof args[0] !== 'string') {
      const target = args[0];
      const overwrite = !!args[1];

      const name = 'attrName' in target ? target.attrName : target.blotName;
      if (typeof name === 'string') {
        // Shortcut for formats:
        // register(Blot | Attributor, overwrite)
        this.register(`formats/${name}`, target, overwrite);
      } else {
        Object.keys(target).forEach((key) => {
          this.register(key, target[key], overwrite);
        });
      }
    } else {
      const path = args[0];
      const target = args[1];
      const overwrite = !!args[2];

      if (this.imports[path] != null && !overwrite) {
        debug.warn(`Overwriting ${path} with`, target);
      }
      this.imports[path] = target;
      if (
        (path.startsWith('blots/') || path.startsWith('formats/')) &&
        target &&
        typeof target !== 'boolean' &&
        target.blotName !== 'abstract'
      ) {
        globalRegistry.register(target);
      }
      if (typeof target.register === 'function') {
        target.register(globalRegistry);
      }
    }
  }

  container: HTMLElement;
  root: HTMLDivElement;
  scroll: Scroll;
  emitter: Emitter;
  protected allowReadOnlyEdits: boolean;
  editor: Editor;
  composition: Composition;
  selection: Selection;

  theme: Theme;
  keyboard: Keyboard;
  clipboard: Clipboard;
  history: History;
  uploader: Uploader;

  options: ExpandedQuillOptions;

  constructor(container: HTMLElement | string, options: QuillOptions = {}) {
    this.options = expandConfig(container, options);
    this.container = this.options.container;
    if (this.container == null) {
      debug.error('Invalid Quill container', container);
      return;
    }
    if (this.options.debug) {
      Quill.debug(this.options.debug);
    }
    const html = this.container.innerHTML.trim();
    this.container.classList.add('ql-container');
    this.container.innerHTML = '';
    instances.set(this.container, this);
    this.root = this.addContainer('ql-editor');
    this.root.classList.add('ql-blank');
    this.emitter = new Emitter();

    // scroll
    const scrollBlotName = Parchment.ScrollBlot.blotName;
    // 前期注册时已调用registry.ts 中的registry 记录在this.type 中，再取出来Scroll class, 注册时是quill/blot/scroll.ts
    const ScrollBlot = this.options.registry.query(scrollBlotName);
    if (!ScrollBlot || !('blotName' in ScrollBlot)) {
      throw new Error(
        `Cannot initialize Quill without "${scrollBlotName}" blot`,
      );
    }
    /*
    * 将blot 实例化后维护好关系，然后生成真实dom , 完成blot 映射成dom  

    * <div class='ql-editor'>  // root
    *   <p>  // Block
    *     </br>  // Break
    *   </p>
    * </div>
    */ 
    // 完成dom加载和blot初始化
    this.scroll = new ScrollBlot(this.options.registry, this.root, {
      emitter: this.emitter,
    }) as Scroll;

    // delta 的初始化 遍历blot 的父子关系 初始化delta
    this.editor = new Editor(this.scroll);

    // 实例化光标 blot ,注册 输入法、鼠标按下等事件
    this.selection = new Selection(this.scroll, this.emitter);
    // 处理合成事件，在中文日文下一般输入法会触发compositionstart事件，英文不会，防止输入拼音时不断触发input 事件
    this.composition = new Composition(this.scroll, this.emitter);
    // 初始化主题即 富文本的工具栏；实例化了下面对应的类
    // SnowTheme、 Bubble 继承BaseTheme 继承 Theme 
    this.theme = new this.options.theme(this, this.options); // eslint-disable-line new-cap
    // 注册默认自带模块，addModule 来自Theme 类提供的； 首先通过 quill.import(modules/${name})类，然后实例化并将参数传入并返回实例对象

    this.keyboard = this.theme.addModule('keyboard');      // 键盘相关事件
    this.clipboard = this.theme.addModule('clipboard');
    this.history = this.theme.addModule('history');
    this.uploader = this.theme.addModule('uploader');  // 图片自动退拽
    // 参数里没有手动添加
    this.theme.addModule('input');  // 
    this.theme.addModule('uiNode');
    // 除了上述几个默认带的，用户自定义的modules、toolbar 实例化并注册，方便后续获取对应的modules
    this.theme.init();
    // 监听 编辑器变化；例如回车，光标插入
    this.emitter.on(Emitter.events.EDITOR_CHANGE, (type) => {
      if (type === Emitter.events.TEXT_CHANGE) {
        //  true时 ， ql-blank 没有自动添加， 有的话什么操作都没， false时， ql-blank 没有什么操作都没， 有的话什么移除
        this.root.classList.toggle('ql-blank', this.editor.isBlank());
      }
    });
     // dom 更新完成
    this.emitter.on(Emitter.events.SCROLL_UPDATE, (source, mutations) => {
      const oldRange = this.selection.lastRange;
      const [newRange] = this.selection.getRange();
      const selectionInfo =
        oldRange && newRange ? { oldRange, newRange } : undefined;
      modify.call(
        this,
        () => this.editor.update(null, mutations, selectionInfo), // blot更新 后同步delta
        source,
      );
    });
    // 监听 embedBlot 事件
    this.emitter.on(Emitter.events.SCROLL_EMBED_UPDATE, (blot, delta) => {
      const oldRange = this.selection.lastRange;
      const [newRange] = this.selection.getRange();
      const selectionInfo =
        oldRange && newRange ? { oldRange, newRange } : undefined;
      modify.call(
        this,
        () => {
          const change = new Delta()
            .retain(blot.offset(this))
            .retain({ [blot.statics.blotName]: delta });
          return this.editor.update(change, [], selectionInfo);
        },
        Quill.sources.USER,
      );
    });

    if (html) {
      // 返回delta 数据
      const contents = this.clipboard.convert({
        html: `${html}<p><br></p>`,
        text: '\n',
      });
      this.setContents(contents);
    }
    this.history.clear();
    if (this.options.placeholder) {
      this.root.setAttribute('data-placeholder', this.options.placeholder);
    }
    if (this.options.readOnly) {
      this.disable();
    }
    this.allowReadOnlyEdits = false;
  }

  addContainer(container: string, refNode?: Node | null): HTMLDivElement;
  addContainer(container: HTMLElement, refNode?: Node | null): HTMLElement;
  addContainer(
    container: string | HTMLElement,
    refNode: Node | null = null,
  ): HTMLDivElement | HTMLElement {
    if (typeof container === 'string') {
      const className = container;
      container = document.createElement('div');
      container.classList.add(className);
    }
    this.container.insertBefore(container, refNode);
    return container;
  }

  blur() {
    this.selection.setRange(null);
  }

  deleteText(range: Range, source?: EmitterSource): Delta;
  deleteText(index: number, length: number, source?: EmitterSource): Delta;
  deleteText(
    index: number | Range,
    length?: number | EmitterSource,
    source?: EmitterSource,
  ): Delta {
    // @ts-expect-error
    [index, length, , source] = overload(index, length, source);
    return modify.call(
      this,
      () => {
        return this.editor.deleteText(index, length);
      },
      source,
      index,
      -1 * length,
    );
  }

  disable() {
    this.enable(false);
  }

  editReadOnly<T>(modifier: () => T): T {
    this.allowReadOnlyEdits = true;
    const value = modifier();
    this.allowReadOnlyEdits = false;
    return value;
  }

  enable(enabled = true) {
    this.scroll.enable(enabled);
    this.container.classList.toggle('ql-disabled', !enabled);
  }

  focus(options: { preventScroll?: boolean } = {}) {
    this.selection.focus();
    if (!options.preventScroll) {
      this.scrollSelectionIntoView();
    }
  }

  format(
    name: string,
    value: unknown,
    source: EmitterSource = Emitter.sources.API,
  ): Delta {
    return modify.call(
      this,
      () => {
        const range = this.getSelection(true);
        let change = new Delta();
        if (range == null) return change;
        if (this.scroll.query(name, Parchment.Scope.BLOCK)) {
          change = this.editor.formatLine(range.index, range.length, {
            [name]: value,
          });
        } else if (range.length === 0) {
          this.selection.format(name, value);
          return change;
        } else {
          change = this.editor.formatText(range.index, range.length, {
            [name]: value,
          });
        }
        this.setSelection(range, Emitter.sources.SILENT);
        return change;
      },
      source,
    );
  }

  formatLine(
    index: number,
    length: number,
    formats: Record<string, unknown>,
    source?: EmitterSource,
  ): Delta;
  formatLine(
    index: number,
    length: number,
    name: string,
    value?: unknown,
    source?: EmitterSource,
  ): Delta;
  formatLine(
    index: number,
    length: number,
    name: string | Record<string, unknown>,
    value?: unknown | EmitterSource,
    source?: EmitterSource,
  ): Delta {
    let formats: Record<string, unknown>;
    // eslint-disable-next-line prefer-const
    [index, length, formats, source] = overload(
      index,
      length,
      // @ts-expect-error
      name,
      value,
      source,
    );
    return modify.call(
      this,
      () => {
        return this.editor.formatLine(index, length, formats);
      },
      source,
      index,
      0,
    );
  }

  formatText(
    range: Range,
    name: string,
    value: unknown,
    source?: EmitterSource,
  ): Delta;
  formatText(
    index: number,
    length: number,
    name: string,
    value: unknown,
    source?: EmitterSource,
  ): Delta;
  formatText(
    index: number,
    length: number,
    formats: Record<string, unknown>,
    source?: EmitterSource,
  ): Delta;
  formatText(
    index: number | Range,
    length: number | string,
    name: string | unknown,
    value?: unknown | EmitterSource,
    source?: EmitterSource,
  ): Delta {
    let formats: Record<string, unknown>;
    // eslint-disable-next-line prefer-const
    [index, length, formats, source] = overload(
      // @ts-expect-error
      index,
      length,
      name,
      value,
      source,
    );
    return modify.call(
      this,
      () => {
        return this.editor.formatText(index, length, formats);
      },
      source,
      index,
      0,
    );
  }

  getBounds(index: number | Range, length = 0): Bounds | null {
    let bounds: Bounds | null = null;
    if (typeof index === 'number') {
      bounds = this.selection.getBounds(index, length);
    } else {
      bounds = this.selection.getBounds(index.index, index.length);
    }
    if (!bounds) return null;
    const containerBounds = this.container.getBoundingClientRect();
    return {
      bottom: bounds.bottom - containerBounds.top,
      height: bounds.height,
      left: bounds.left - containerBounds.left,
      right: bounds.right - containerBounds.left,
      top: bounds.top - containerBounds.top,
      width: bounds.width,
    };
  }

  getContents(index = 0, length = this.getLength() - index) {
    [index, length] = overload(index, length);
    return this.editor.getContents(index, length);
  }

  getFormat(index?: number, length?: number): { [format: string]: unknown };
  getFormat(range?: Range): {
    [format: string]: unknown;
  };
  getFormat(
    index: Range | number = this.getSelection(true),
    length = 0,
  ): { [format: string]: unknown } {
    if (typeof index === 'number') {
      return this.editor.getFormat(index, length);
    }
    return this.editor.getFormat(index.index, index.length);
  }

  getIndex(blot: Parchment.Blot) {
    return blot.offset(this.scroll);
  }

  getLength() {
    return this.scroll.length();
  }

  getLeaf(index: number) {
    return this.scroll.leaf(index);
  }

  getLine(index: number) {
    return this.scroll.line(index);
  }

  getLines(range: Range): (Block | BlockEmbed)[];
  getLines(index?: number, length?: number): (Block | BlockEmbed)[];
  getLines(
    index: Range | number = 0,
    length = Number.MAX_VALUE,
  ): (Block | BlockEmbed)[] {
    if (typeof index !== 'number') {
      return this.scroll.lines(index.index, index.length);
    }
    return this.scroll.lines(index, length);
  }

  getModule(name: string) {
    return this.theme.modules[name];
  }

  getSelection(focus: true): Range;
  getSelection(focus?: boolean): Range | null;
  getSelection(focus = false): Range | null {
    if (focus) this.focus();
    this.update(); // Make sure we access getRange with editor in consistent state
    return this.selection.getRange()[0];
  }

  getSemanticHTML(range: Range): string;
  getSemanticHTML(index?: number, length?: number): string;
  getSemanticHTML(index: Range | number = 0, length?: number) {
    if (typeof index === 'number') {
      length = length ?? this.getLength() - index;
    }
    // @ts-expect-error
    [index, length] = overload(index, length);
    return this.editor.getHTML(index, length);
  }

  getText(range?: Range): string;
  getText(index?: number, length?: number): string;
  getText(index: Range | number = 0, length?: number): string {
    if (typeof index === 'number') {
      length = length ?? this.getLength() - index;
    }
    // @ts-expect-error
    [index, length] = overload(index, length);
    return this.editor.getText(index, length);
  }

  hasFocus() {
    return this.selection.hasFocus();
  }

  insertEmbed(
    index: number,
    embed: string,
    value: unknown,
    source: EmitterSource = Quill.sources.API,
  ): Delta {
    return modify.call(
      this,
      () => {
        return this.editor.insertEmbed(index, embed, value);
      },
      source,
      index,
    );
  }

  insertText(index: number, text: string, source?: EmitterSource): Delta;
  insertText(
    index: number,
    text: string,
    formats: Record<string, unknown>,
    source?: EmitterSource,
  ): Delta;
  insertText(
    index: number,
    text: string,
    name: string,
    value: unknown,
    source?: EmitterSource,
  ): Delta;
  insertText(
    index: number,
    text: string,
    name?: string | Record<string, unknown> | EmitterSource,
    value?: unknown,
    source?: EmitterSource,
  ): Delta {
    let formats: Record<string, unknown>;
    // eslint-disable-next-line prefer-const
    // @ts-expect-error
    [index, , formats, source] = overload(index, 0, name, value, source);
    return modify.call(
      this,
      () => {
        return this.editor.insertText(index, text, formats);
      },
      source,
      index,
      text.length,
    );
  }

  isEnabled() {
    return this.scroll.isEnabled();
  }

  off(...args: Parameters<(typeof Emitter)['prototype']['off']>) {
    return this.emitter.off(...args);
  }

  on(
    event: (typeof Emitter)['events']['TEXT_CHANGE'],
    handler: (delta: Delta, oldContent: Delta, source: EmitterSource) => void,
  ): Emitter;
  on(
    event: (typeof Emitter)['events']['SELECTION_CHANGE'],
    handler: (range: Range, oldRange: Range, source: EmitterSource) => void,
  ): Emitter;
  on(
    event: (typeof Emitter)['events']['EDITOR_CHANGE'],
    handler: (
      ...args:
        | [
            (typeof Emitter)['events']['TEXT_CHANGE'],
            Delta,
            Delta,
            EmitterSource,
          ]
        | [
            (typeof Emitter)['events']['SELECTION_CHANGE'],
            Range,
            Range,
            EmitterSource,
          ]
    ) => void,
  ): Emitter;
  on(event: string, ...args: unknown[]): Emitter;
  on(...args: Parameters<(typeof Emitter)['prototype']['on']>): Emitter {
    return this.emitter.on(...args);
  }

  once(...args: Parameters<(typeof Emitter)['prototype']['once']>) {
    return this.emitter.once(...args);
  }

  removeFormat(index: number, length: number, source?: EmitterSource): Delta {
    [index, length, , source] = overload(index, length, source);
    return modify.call(
      this,
      () => {
        return this.editor.removeFormat(index, length);
      },
      source,
      index,
    );
  }

  scrollRectIntoView(rect: Rect) {
    scrollRectIntoView(this.root, rect);
  }

  /**
   * @deprecated Use Quill#scrollSelectionIntoView() instead.
   */
  scrollIntoView() {
    console.warn(
      'Quill#scrollIntoView() has been deprecated and will be removed in the near future. Please use Quill#scrollSelectionIntoView() instead.',
    );
    this.scrollSelectionIntoView();
  }

  /**
   * Scroll the current selection into the visible area.
   * If the selection is already visible, no scrolling will occur.
   */
  scrollSelectionIntoView() {
    const range = this.selection.lastRange;
    const bounds = range && this.selection.getBounds(range.index, range.length);
    if (bounds) {
      this.scrollRectIntoView(bounds);
    }
  }

  setContents(
    delta: Delta | Op[],
    source: EmitterSource = Emitter.sources.API,
  ): Delta {
    return modify.call(
      this,
      () => {
        delta = new Delta(delta);
        const length = this.getLength();
        // Quill will set empty editor to \n
        const delete1 = this.editor.deleteText(0, length);
        const applied = this.editor.insertContents(0, delta);
        // Remove extra \n from empty editor initialization
        const delete2 = this.editor.deleteText(this.getLength() - 1, 1);
        return delete1.compose(applied).compose(delete2);
      },
      source,
    );
  }
  setSelection(range: Range | null, source?: EmitterSource): void;
  setSelection(index: number, source?: EmitterSource): void;
  setSelection(index: number, length?: number, source?: EmitterSource): void;
  setSelection(index: number, source?: EmitterSource): void;
  setSelection(
    index: Range | null | number,
    length?: EmitterSource | number,
    source?: EmitterSource,
  ): void {
    if (index == null) {
      // @ts-expect-error https://github.com/microsoft/TypeScript/issues/22609
      this.selection.setRange(null, length || Quill.sources.API);
    } else {
      // @ts-expect-error
      [index, length, , source] = overload(index, length, source);
      this.selection.setRange(new Range(Math.max(0, index), length), source);
      if (source !== Emitter.sources.SILENT) {
        this.scrollSelectionIntoView();
      }
    }
  }

  setText(text: string, source: EmitterSource = Emitter.sources.API) {
    const delta = new Delta().insert(text);
    return this.setContents(delta, source);
  }

  update(source: EmitterSource = Emitter.sources.USER) {
    const change = this.scroll.update(source); // Will update selection before selection.update() does if text changes
    this.selection.update(source);
    // TODO this is usually undefined
    return change;
  }
  // 运行时根据 delta 来更新blot
  updateContents(
    delta: Delta | Op[],
    source: EmitterSource = Emitter.sources.API,
  ): Delta {
    return modify.call(
      this,
      () => {
        delta = new Delta(delta);
        return this.editor.applyDelta(delta);
      },
      source,
      true,
    );
  }
}

function resolveSelector(selector: string | HTMLElement | null | undefined) {
  return typeof selector === 'string'
    ? document.querySelector<HTMLElement>(selector)
    : selector;
}

function expandModuleConfig(config: Record<string, unknown> | undefined) {
  return Object.entries(config ?? {}).reduce(
    (expanded, [key, value]) => ({
      ...expanded,
      [key]: value === true ? {} : value,
    }),
    {} as Record<string, unknown>,
  );
}

function omitUndefinedValuesFromOptions(obj: QuillOptions) {
  return Object.fromEntries(
    Object.entries(obj).filter((entry) => entry[1] !== undefined),
  );
}

function expandConfig(
  containerOrSelector: HTMLElement | string,
  options: QuillOptions,
): ExpandedQuillOptions {
  const container = resolveSelector(containerOrSelector);
  if (!container) {
    throw new Error('Invalid Quill container');
  }

  const shouldUseDefaultTheme =
    !options.theme || options.theme === Quill.DEFAULTS.theme;
  const theme = shouldUseDefaultTheme
    ? Theme
    : Quill.import(`themes/${options.theme}`);
  if (!theme) {
    throw new Error(`Invalid theme ${options.theme}. Did you register it?`);
  }

  const { modules: quillModuleDefaults, ...quillDefaults } = Quill.DEFAULTS;
  const { modules: themeModuleDefaults, ...themeDefaults } = theme.DEFAULTS;

  let userModuleOptions = expandModuleConfig(options.modules);
  // Special case toolbar shorthand
  if (
    userModuleOptions != null &&
    userModuleOptions.toolbar &&
    userModuleOptions.toolbar.constructor !== Object
  ) {
    userModuleOptions = {
      ...userModuleOptions,
      toolbar: { container: userModuleOptions.toolbar },
    };
  }

  const modules: ExpandedQuillOptions['modules'] = merge(
    {},
    expandModuleConfig(quillModuleDefaults),
    expandModuleConfig(themeModuleDefaults),
    userModuleOptions,
  );

  const config = {
    ...quillDefaults,
    ...omitUndefinedValuesFromOptions(themeDefaults),
    ...omitUndefinedValuesFromOptions(options),
  };

  let registry = options.registry;
  if (registry) {
    if (options.formats) {
      debug.warn('Ignoring "formats" option because "registry" is specified');
    }
  } else {
    registry = options.formats
      ? createRegistryWithFormats(options.formats, config.registry, debug)
      : config.registry;
  }

  return {
    ...config,
    registry,
    container,
    theme,
    modules: Object.entries(modules).reduce(
      (modulesWithDefaults, [name, value]) => {
        if (!value) return modulesWithDefaults;

        const moduleClass = Quill.import(`modules/${name}`);
        if (moduleClass == null) {
          debug.error(
            `Cannot load ${name} module. Are you sure you registered it?`,
          );
          return modulesWithDefaults;
        }
        return {
          ...modulesWithDefaults,
          // @ts-expect-error
          [name]: merge({}, moduleClass.DEFAULTS || {}, value),
        };
      },
      {},
    ),
    bounds: resolveSelector(config.bounds),
  };
}

// Handle selection preservation and TEXT_CHANGE emission
// common to modification APIs
function modify(
  modifier: () => Delta,  // 修饰符 函数
  source: EmitterSource,
  index: number | boolean,
  shift: number | null,
) {
  if (
    !this.isEnabled() &&
    source === Emitter.sources.USER &&
    !this.allowReadOnlyEdits
  ) {
    return new Delta();
  }
  let range = index == null ? null : this.getSelection();
  const oldDelta = this.editor.delta;
  // 返回delta
  const change = modifier();
  if (range != null) {
    if (index === true) {
      index = range.index; // eslint-disable-line prefer-destructuring
    }
    if (shift == null) {
      range = shiftRange(range, change, source);
    } else if (shift !== 0) {
      // @ts-expect-error index should always be number
      range = shiftRange(range, index, shift, source);
    }
    this.setSelection(range, Emitter.sources.SILENT);
  }
  if (change.length() > 0) {
    const args = [Emitter.events.TEXT_CHANGE, change, oldDelta, source];
    this.emitter.emit(Emitter.events.EDITOR_CHANGE, ...args);
    if (source !== Emitter.sources.SILENT) {
      this.emitter.emit(...args);
    }
  }
  return change;
}

type NormalizedIndexLength = [
  number,
  number,
  Record<string, unknown>,
  EmitterSource,
];
function overload(index: number, source?: EmitterSource): NormalizedIndexLength;
function overload(
  index: number,
  length: number,
  source?: EmitterSource,
): NormalizedIndexLength;
function overload(
  index: number,
  length: number,
  format: string,
  value: unknown,
  source?: EmitterSource,
): NormalizedIndexLength;
function overload(
  index: number,
  length: number,
  format: Record<string, unknown>,
  source?: EmitterSource,
): NormalizedIndexLength;
function overload(range: Range, source?: EmitterSource): NormalizedIndexLength;
function overload(
  range: Range,
  format: string,
  value: unknown,
  source?: EmitterSource,
): NormalizedIndexLength;
function overload(
  range: Range,
  format: Record<string, unknown>,
  source?: EmitterSource,
): NormalizedIndexLength;
function overload(
  index: Range | number,
  length?: number | string | Record<string, unknown> | EmitterSource,
  name?: string | unknown | Record<string, unknown> | EmitterSource,
  value?: unknown | EmitterSource,
  source?: EmitterSource,
): NormalizedIndexLength {
  let formats: Record<string, unknown> = {};
  // @ts-expect-error
  if (typeof index.index === 'number' && typeof index.length === 'number') {
    // Allow for throwaway end (used by insertText/insertEmbed)
    if (typeof length !== 'number') {
      // @ts-expect-error
      source = value;
      value = name;
      name = length;
      // @ts-expect-error
      length = index.length; // eslint-disable-line prefer-destructuring
      // @ts-expect-error
      index = index.index; // eslint-disable-line prefer-destructuring
    } else {
      // @ts-expect-error
      length = index.length; // eslint-disable-line prefer-destructuring
      // @ts-expect-error
      index = index.index; // eslint-disable-line prefer-destructuring
    }
  } else if (typeof length !== 'number') {
    // @ts-expect-error
    source = value;
    value = name;
    name = length;
    length = 0;
  }
  // Handle format being object, two format name/value strings or excluded
  if (typeof name === 'object') {
    // @ts-expect-error Fix me later
    formats = name;
    // @ts-expect-error
    source = value;
  } else if (typeof name === 'string') {
    if (value != null) {
      formats[name] = value;
    } else {
      // @ts-expect-error
      source = name;
    }
  }
  // Handle optional source
  source = source || Emitter.sources.API;
  // @ts-expect-error
  return [index, length, formats, source];
}

function shiftRange(range: Range, change: Delta, source?: EmitterSource): Range;
function shiftRange(
  range: Range,
  index: number,
  length?: number,
  source?: EmitterSource,
): Range;
function shiftRange(
  range: Range,
  index: number | Delta,
  lengthOrSource?: number | EmitterSource,
  source?: EmitterSource,
) {
  const length = typeof lengthOrSource === 'number' ? lengthOrSource : 0;
  if (range == null) return null;
  let start;
  let end;
  // @ts-expect-error -- TODO: add a better type guard around `index`
  if (index && typeof index.transformPosition === 'function') {
    [start, end] = [range.index, range.index + range.length].map((pos) =>
      // @ts-expect-error -- TODO: add a better type guard around `index`
      index.transformPosition(pos, source !== Emitter.sources.USER),
    );
  } else {
    [start, end] = [range.index, range.index + range.length].map((pos) => {
      // @ts-expect-error -- TODO: add a better type guard around `index`
      if (pos < index || (pos === index && source === Emitter.sources.USER))
        return pos;
      if (length >= 0) {
        return pos + length;
      }
      // @ts-expect-error -- TODO: add a better type guard around `index`
      return Math.max(index, pos + length);
    });
  }
  return new Range(start, end - start);
}

export type { Bounds, DebugLevel, EmitterSource };
export { Parchment, Range };

export { globalRegistry, expandConfig, overload, Quill as default };
