# Speed Read It!

`srit` is a command line tool to speed read any text.

## Usage

Any of the following commands:
```
cat sometext.txt | srit -
srit sometext.txt
srit doc.pdf
srit foo.md
srit report.doc
srit http://thisblog.url.org/somewhere
```

will make the terminal get clear, and display on its center (both
vertical and horizontal) one word of the text at the time, with the
median letter colored and always at the same position on screen. We
move to the next word of the text at regular pace, with punctation
introducing a slight pause. A progress bar at the bottom shows the
position of the current word in the text (except in pipe mode where
we don't have the length of the full text).

While the text is displayed that way, the user can:
- Hit "left arrow" to come back to the previous word
- Hit "right arrow" to move forward to the next word
- Hit "up arrow" to increase the pace
- Hit "down arrow" to decrease the pace
- Resize the terminal
- Hit "escape" to exit

The pace is stored in a file $HOME/.srit.json

In this file you can configure the colors used by the tool.

## Installation

```
npm i -g @yurug-js/srit
```

## License

MIT

## Philosophy

This program follows the KISS principle: it does one specific thing
and aims to do it right, with no dependencies and clear
semantics. Contributions are welcome as long as they adhere to this
philosophy!
