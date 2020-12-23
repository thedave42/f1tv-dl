# f1tv-dl

Watch videos locally from f1tv website 

Note: a valid username/password is required.  The app will save your session so the they will only be required again when your session has expried.

```
f1tv-dl <url>

Positionals:
  url  The f1tv url for the video                                       [string]

Options:
      --help              Show help                                    [boolean]
      --version           Show version number                          [boolean]
  -c, --channel           Choose wif,driver,data,pit lane or specify driver
                          name/number/tla              [string] [default: "wif"]
  -v, --program-stream    Specify the program for the video stream
                                                         [string] [default: "0"]
  -a, --audio-stream      Specify audio stream index to download
                                                         [string] [default: "0"]
  -f, --format            Specify mp4 or TS output (default mp4)
                                [string] [choices: "mp4", "ts"] [default: "mp4"]
  -o, --output-directory  Specify a directory for the downloaded file
                                                        [string] [default: null]
  -U, --username          F1TV User name                [string] [default: null]
  -P, --password          F1TV password                 [string] [default: null]
      --channel-list      Provides a list of channels available from url (for
                          videos with multiple cameras)
                                                      [boolean] [default: false]
  -l, --log-level         set the log level
          [choices: "trace", "debug", "info", "warn", "error"] [default: "info"]
```

## Use
Clone the repo and run npm install to install dependencies. 

(ffmpeg is required and needs to be installed manually)
```
git clone https://github.com/thedave42/f1tv-dl.git
cd f1tv-dl
npm i -g
```
or use Docker (no need to install ffmpeg)
```
docker run -v <your local directory>:/download ghcr.io/thedave42/f1tv-dl-docker:latest -o /download <url> [options] 
```

## Download a video 

Log in to your f1tv account, navigate to the video you want to watch, and copy the url from your browser.

`f1tv-dl <url>`

## See a list of different video feeds from a race with multiple feeds

`f1tv-dl <url> --channel-list`
