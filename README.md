# f1tv-dl

Use to download videos from f1tv website

```
index.js <url>

Download a video

Positionals:
  url  The f1tv url for the video                                       [string]

Options:
  --help              Show help                                        [boolean]
  --version           Show version number                              [boolean]
  --channel, -c       Choose wif,driver,data,pit lane or specify driver
                      name/number/tla                  [string] [default: "wif"]
  --audio-stream, -a  Specify audio stream index to download
                                                         [string] [default: "0"]
  --channel-list      Provides a list of channels available from url (for videos
                      with multiple cameras)          [boolean] [default: false]
```

## Install
Clone the repo and run npm install to install dependencies.
`git clone https://github.com/thedave42/f1tv-dl.git`
`cd f1tv-dl`
`npm i`

## Download a video 

`node index.js https://f1tv.formula1.com/en/current-season/abu-dhabi-grand-prix/2019-abu-dhabi-grand-prix-race`

## See a list of different video feeds from a race with multiple feeds

`node index.js https://f1tv.formula1.com/en/current-season/abu-dhabi-grand-prix/2019-abu-dhabi-grand-prix-race --channel-list`
