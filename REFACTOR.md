```
Command line
    - channel list
    - video download
        - set authdata object
            -user, pass, jwt
        - getItemUrl
            if there is user/pass, call loginF1
                axios.post to auth api to request auth by password
                then
                    save identity provider url and access token
                    call axios.post to authenticate
                    then
                        return token
                error 
                    log to error
                    return null
            then
                replace jwt in authData object with new token
                check if url is is episode or race session
                    episode 
                        call getEpisodeUrl
                            call getSlugName to get name from url string
                            axios.get
                                params: slug
                            then
                                return response.data.objects.shift().items.shift() // return the url
                            error
                                log to console.error
                                re-throw error
                    session
                        call getSessionUrl
                            need extra param to identify "channel" - searchStr
                            call getSlugName to get name from urlStr
                            axios.get
                                params: slug
                            then
                                call getSessionChannelUrl (recursive)
                                    params: data.channel_urls (list of channels from last call), searchStr
                                    grab first channel from list
                                    axios.get channel (lookup channel data)
                                        params: fields_to_expand (gives more data in response call)
                                    then
                                        if there's no channel name, we're done.  no channel matches the searchStr
                                        response data object is based on channel type, so based on channel type store response data in an array called data
                                        do a case insensitive search on the data array to see if the data contains our search string
                                        if it does, return the data and we're done, exit here // return the url
                                        check the next channel in the list to see if it matches our search string
        - then
            'item' now contains the URL to the content, and we have to get a tokenized url to the stream link
```



                                        



                    
            
        
