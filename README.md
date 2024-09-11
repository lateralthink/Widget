# LateralThink.club's javascript Widget

This library allows to create responsive javascript widgets without bundles, webcomponents or other "to much for me" components libraries

## How to use it
Define the component's template or templates in your HTML file:
```html
<template id="User">
  <div class="avatar placeholder">
    <div class="bg-neutral text-neutral-content w-8 rounded-full">
      <span data-prop="username"></span>
    </div>
  </div>
</template>
```
1. The template's id should be the name of the class of your widget
2. ```data-prop```defines the placeholder for the object's property. User should have a property called username


Create a js file for the class or classes for your component

Import the LT's Widget library:
```javascript
import { Widget } from './widget.js';
```
Create your class:
```javascript
export class User extends Widget {
  usernameRenderer (value) { return value.split(" ").map(w => w[0]).join("") }
  set username (value) { this.value.username = value }
  get username () { return this.value.username }
}
```
1. Since this library uses Proxies to redraw the widget, getters and setter can be defined for convenience
2. If a property needs transformation, ```<property name>Renderer (value)``` can be defined to transform it before rendered. ```usernameRenderer``` will render the initials of the username. Ex: ```{ username: "Garito Yanged"}``` will render ```GY```

Use your widget in the same page you defined the template:
```javascript
<script type="module">
  import { User } from './yourclass.js';

  const user = new User({ username: "Garito" });
  user.render(".user");
</script>

<div class="user"></div>
```
1. Import your class
2. Create an object. The initial data is optional
3. Render the object in the container

## Advanced use
Besides the ```<property name>Renderer```, the class can define a ```renderer (tag)```function that will be called as soon as the object is created. This allows to change the HTML code of the object. Giving the Users widget, this can be done:
```javascript
export class Myself extends User {
  renderer (tag) {
    const bg = tag.querySelector(":scope > div");
    bg.classList.remove("bg-neutral", "text-neutral-content");
    bg.classList.add("bg-primary", "text-primary-content");
    return tag;
  }
}
```
This code will change the background of the user

If and object property changes, the widget will automatically redraw it if it has html placeholder (as username)

### Widgets with array properties
More advanced widgets will need to manage array properties. For that, templates for the arrays items must be defined

Continuing with the previous examples, ```User``` and ```Myself```represent the users of a chat widget where ```User``` would represent the users connected to it and ```Myself``` would represent the current user (in the example, ```Users``` would have black background and ```Myself``` would have primary background using [Tailwind](https://tailwindcss.com/) and [DaisyUI](https://daisyui.com/))

So the chat itself template could look like this:
```html
<template id="Chat">
    <div data-class="Chat" class="w-3/12 h-[calc(100vh-5rem)] flex flex-col gap-2">
      <div class="flex flex-1 w-full">
        <div data-prop="msgs" data-type="Array" class="flex flex-col-reverse flex-0 px-2 w-full h-full overflow-y-auto"></div>
        <div data-prop="users" data-type="Array" class="flex flex-col gap-2 flex-1 px-2 w-full h-full"></div>
      </div>
      <form class="join">
        <input name="msg" class="input input-bordered join-item w-full" placeholder="Type your message" disabled />
        <button type="submit" class="btn join-item" disabled>Send</button>
      </form>
    </div>
  </template>
```
Notice that there are two array properties: ```msgs``` and ```users``` so ```Message``` template should be defined too (check the index.html file for the complete example)

Then, on the constructor of the ```Chat``` class, a class selector must be defined and passed to the ```Widget``` constructor as ```super```

If you go to ```chat.js``` you will find a demostration were:
1. The name of the array and the object to be added to the array will be provided as arguments
2. In the example, two arrays are defined so the class selector should cover both arrays
3. In the ```users``` case, there are two options: the user is the current user where ```Myself``` class would be returned and the rest of the users where ```User``` class must be used
4. In the ```msgs```case, there are three options: ```Message``` form messages from users, ```MyMessage``` for messages from the current user and ```SysMessage``` for messages from the system

Since ```MyMessage``` and ```SysMessage``` are extensions of ```Message``` specific templates could be defined but not needed. The widget will select the first template found by iterating the object's class inheritance. In those cases will be ```MyMessage``` -> ```Message``` -> ```Widget``` and ```Myself``` -> ```User``` -> ```Widget```

Check ```chat.js``` for a complete, functional widget. Obviously you must proovide a compatible websockets server for it to work