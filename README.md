# code-sandbox web component

This is a fork of [code-sandbox](https://gist.github.com/cferdinandi/df9c95ae5f5ebcddf2ab85bb2805ff07) web component from [Chris Ferdinandi](https://gomakethings.com) for displaying an interactive code sandbox for HTML, CSS and javascript, similar to what **CodePen** does.

Having a code sandbox web component can be useful for showing code snippets in a more interactive way, and it doesn't require any external third-party services like **CodePen** or **JSFiddle**.

Also being a web component, it means it can be used in any framework or vanilla JavaScript and it will always work, since it doesn't depend on any framework. The only dependency it uses is [PrismJS](https://prismjs.com/) for syntax highlighting, which can be included directly in the JavaScript file. This fork adds a few useful features to the original code too.

## Attributes

| Attribute | Description                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| `console`    | If present displays the console (Optional) |
| `hidden`     | Used to prevent flashes of unstyled content      |
| `name`    | The name attribute to be attached to the `<details>` elements, which makes only one open at the time (Optional) |
| `result`     | Controls what is displayed on the right side panel, can either be `iframe` or `console`. Defaults to `iframe`     |
| `src`     | The URL of the file to fetch and run in the sandbox. Can be on the same origin or a remote file (Optional)      |
| `title`   | The title of the code block, defaults to `Code sandbox`. (Optional)                                             |

### Resources

- [cferdinandi/code-sandbox](https://gist.github.com/cferdinandi/df9c95ae5f5ebcddf2ab85bb2805ff07)
- [PrismJS](https://prismjs.com/)
