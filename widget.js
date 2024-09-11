export class Widget {
  container;
  value;
  tmpl;
  props = {};

  #objectHandler = {
    set: (target, prop, value, receiver) => {
      const renderer = `${ prop }Renderer`;
      if (Object.keys(this.props).includes(prop)) {
        const val = this[renderer] ? this[renderer](value, this.props[prop]) : value;
        this.props[prop].textContent = val;
      }
      return Reflect.set(target, prop, value, receiver);
    }
  }

  #arrayHandler = {
    get: (target, property, receiver) => {
      switch (property) {
        case "pop":
          return (...arg) => {
            const poped = target[property](...arg);
            poped.tmpl.remove();
            return poped;
          }
        case "slice":
        case "splice":
          return (...arg) => {
            const removed = target[property](...arg);
            for (const item of removed) {
              item.tmpl.remove();
            }
            return removed;
          }
      }
      return Reflect.get(target, property, receiver);
    },
    set: (target, prop, value, receiver) => {
      if (!isNaN(prop)) value.render();
      return Reflect.set(target, prop, value, receiver);
    }
  }

  #getClasses = function* () {
    let superClass = Object.getPrototypeOf(this);
    while (superClass !== null) {
      yield superClass.constructor.name;
      superClass = Object.getPrototypeOf(superClass);
    }
  }

  constructor (value, classes, container) {
    this.container = container;
    for (const className of this.#getClasses()) {
      const tmpl = document.querySelector(`template#${ className }`);
      if (tmpl) {
        this.tmpl = tmpl.content.cloneNode(true).children[0];
        break;
      }
    }

    this.value = new Proxy({}, this.#objectHandler);
    const valueKeys = Object.keys(value);
    for (const prop of this.tmpl.querySelectorAll("[data-prop]")) {
      const propName = prop.dataset.prop;
      valueKeys.splice(valueKeys.indexOf(propName), 1);
      this.props[propName] = prop;
      let propType = prop.dataset.type || "String";

      if (value[propName]) {
        switch (propType) {
          case "Date":
            if (typeof value[propName] === 'number') this.value[propName] = new Date(value[propName]);
            else if (typeof value[propName] === 'string') this.value[propName] = Date.parse(value[propName]);
            else this.value[propName] = value[propName];
            break;
          case "Integer":
            if (typeof value[propName] !== Number) this.value[propName] = parseInt(value[propName]);
            else this.value[propName] = value[propName];
            break;
          case "Float":
            if (typeof value[propName] !== Number) this.value[propName] = parseFloat(value[propName]);
            else this.value[propName] = value[propName];
          case "Array":
            this.value[propName] = new Proxy([], this.#arrayHandler);
            this.value[propName].push(...value[propName].map(o => {
              const klass = classes(propName, o);
              return new klass(o, undefined, prop);
            }));
            break;
          default:
            this.value[propName] = value[propName];
        }
      } else {
        switch (propType) {
          case "Array":
            this.value[propName] = new Proxy([], this.#arrayHandler);
            break;
          case "Integer":
          case "Float":
            this.value[propName] = 0;
            break;
          default:
            this.value[propName] = "";
        }
      }
    }
    for (const propName of valueKeys) {
      this.value[propName] = value[propName];
    }
    if (this.renderer) this.tmpl = this.renderer(this.tmpl);
  }

  render (selector) {
    if (selector === undefined && this.container) selector = this.container;
    else if (typeof selector === "string") selector = document.querySelector(selector);

    if (Object.keys(selector.dataset).includes("reversed")) {
      selector.prepend(this.tmpl);
      this.tmpl = selector.querySelector(":scope > :first-child");
    } else {
      selector.appendChild(this.tmpl);
      this.tmpl = selector.querySelector(":scope > :last-child");
    }
  }
}