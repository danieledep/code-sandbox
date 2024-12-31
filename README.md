# code-sandbox web component

A fork of [code-sandbox](https://gist.github.com/cferdinandi/df9c95ae5f5ebcddf2ab85bb2805ff07) web component from Chris Ferdinandi for displaying an interactive code sandbox for html, css and javascript, similar to what CodePen does. 

This fork adds the possibility to fetch a file from a URL and run it in the sandbox, by just adding an attribute `src="css/component.css"` to the web component. This can allow to keep the code snippets in a separate file and include them only on page load. This fork also adds the ability to pass a `title` to the web component and the `name` attribute which gets attached to all the `<details>` elements, making only one editor open at the time, leveraging the native element behavior.

## Attributes

| Attribute | Description                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| `console`    | If present displays the console (Optional) |
| `hidden`     | Used to prevent flashes of unstyled content      |
| `result`     | Controls what is displayed on the right side panel, can either be `iframe` or `console`. Defaults to `iframe`     |
| `name`    | The name attribute to be attached to the `<details>` elements, which makes only one open at the time (Optional) |
| `src`     | The URL of the file to fetch and run in the sandbox. Can be on the same origin or a remote file (Optional)      |
| `title`   | The title of the code block, defaults to `Code sandbox`. (Optional)                                             |


### Resources

- [cferdinandi/code-sandbox](https://gist.github.com/cferdinandi/df9c95ae5f5ebcddf2ab85bb2805ff07)
- [PrismJS](https://prismjs.com/)
