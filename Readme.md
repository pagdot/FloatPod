# Floatplane to Podcast Converter

Convert video content from [floatplane](https://floatplane.com/) and be able to consume it as a podcast audio feed.

## Features

- Scan floatplane for new content
- Conversion to mp3
- Support for multiple generated podcasts
- Filter on a subchannel
- Filter based on the duration (minimal, maximal)
- Filter based on the title
- Docker container with cron for scheduled execution

It doesn't serve the content! A web server is required to servce the generated files!

## Run it on your server

Example for the docker-compose file is in [docker-compose.yml](https://github.com/pagdot/FloatPod/blob/main/docker-compose.yml)

To serve the generated podcasts, you still need some webserver. This tool just downloads the content and generates the feeds!

### Supported environment variables

- **`PUID`:** Specify the user (by id) this container runs as. Should match with the file permissions for the config and data folder
- **`PUID`:** Specify the group (by id) this container runs as. Should match with the file permissions for the config and data folder
- **`TZ`:** Specify a timezone to use, see this [list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones#List).

## Configuration

The container expects on startup a config file in `/config/config.yml` or puts the example one there if there exists one.

### Fields in the config file

- **`account`**: Contains login credentials of *your* floatplane account
  - **`user`**: Username of your account
  - **`password`**: Password of your account
- **`base_folder`**: Path where it should generate the feed and put the mp3-files
- **`tmp_folder`**: Path to use for temporary files (downloaded video before conversion)
- **`state_path`**: Path to put the state file to store which episodes where downloaded already
- **`base_url`**: Base url for links to mp3-files to work
- **`channels`**: List of channels you want to create podcasts for
  - **`title`**: Title of the generated podcast (for it's metadata)
  - **`slug`**: Slug for name of the generated xml-feed-file and the folder containing the episodes
  - **`creator`**: The floatplane creator. You can get it from the url if you are on the channel (`https://www.floatplane.com/channel/<CREATOR>/`)
  - **`channel`** (optional): If the creator has subchannels and you want to to select one. You can get it from the url if you are on the subchannel (`https://www.floatplane.com/channel/<CREATOR>/home/<SUBCHANNEL>`)
  - **`count`** (optional): The number of posts to fetch while checking for new content (going higher than 10 can cause limits with the floatplane api, so stay max at 10)
  - **`quality`** (optional): The quality of the video to fetch (e.g. 360p, 480p, 720p, 1080p, 4K)
  - **`image`** (optional): Url of an image to use as thumbnail for the podcast
  - **`categories`** (optional): List of categories the podcast falls in
  - **`language`** (optional): Language shortcode of the podcast
  - **`filter`** (optional): Filters to filter videos out:
    - **`title`** (optional): JavaScript regular expression the title must fulfill ([documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions), [playground](https://regex101.com/))
    - **`not_title`** (optional): JavaScript regular expression the title must not fulfill ([documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions), [playground](https://regex101.com/))
  - **`min_length`** (optional): Minimal length in seconds required
  - **`max_length`** (optional): Maximal length in seconds required

### Timeschedule

Per default every hour floatpod is executed to check for new content. The crontab to control this is in /config/crontabs/root and can be modified

## Setting up development

1. Download all node modules with `npm install`
2. Create config file
3. Compile the typescrip code to javascript with `tsc`
4. Run with `npm start` or `node out/index.js`
