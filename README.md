# f1tv-dl

Watch videos locally from f1tv website

Note: a valid username/password is required. The app will save your session so the they will only be required again when your session has expried.

```
f1tv-dl <url>

Positionals:
  url                                                                   [string]

Options:
      --help              Show help                                    [boolean]
      --version           Show version number                          [boolean]
  -c, --channel                                         [string] [default: null]
  -f, --format                  [string] [choices: "mp4", "ts"] [default: "mp4"]
  -o, --output-directory                                [string] [default: null]
  -U, --username                 [string] [default: null]
  -P, --password                       [string] [default: null]
      --channel-list                                  [boolean] [default: false]
  -l, --log-level
          [choices: "trace", "debug", "info", "warn", "error"] [default: "info"]
```

## Use

Clone the repo and run npm install to install dependencies.

([ffmpeg](https://www.ffmpeg.org/) is required and needs to be installed manually)

```
git clone https://github.com/thedave42/f1tv-dl.git
cd f1tv-dl
npm i -g
```

or use Docker (no need to install ffmpeg)

```
docker run -v <your local directory>:/download ghcr.io/thedave42/f1tv-dl-docker:latest -o /download <url> [options]
```

Username and password can also be read from the environment variables `F1TV_USER` and `F1TV_PASS`.

## Download a video

Log in to your f1tv account, navigate to the video you want to watch, and copy the url from your browser.

`f1tv-dl <url>`

## See a list of different video feeds from a race with multiple feeds

`f1tv-dl <url> --channel-list`

## Download the pit lane channel stream from a race

`f1tv-dl <url> -c pit`
