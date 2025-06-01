import YAML from 'yaml'
import RSS from 'rss'
import fs from 'fs'
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { Floatplane } from 'floatplane';
import { BlogPost } from 'floatplane/creator';

class FilterConfig {
    title? : string = undefined;
    not_title? : string = undefined;
    min_length : number | undefined = undefined;
    max_length : number | undefined = undefined;
}

class ChannelConfig {
    title : string = '';
    slug : string = '';
    creator : string = '';
    channel? : string = undefined;
    quality : string = '480p';
    count : number = 10;
    image : string = '';
    categories : string[] = [];
    language : string = '';
    filter? : FilterConfig = undefined;
}

class PostState {
    title : string = '';
    mp3 : string = '';
    description : string = '';
    url : string = '';
    id : string = '';
    date : string = '';
    duration : number = 0;
}

class ChannelState {
    slug : string = '';
    url = '';
    posts : PostState[] = [];
}

class State {
    channels : ChannelState[] = [];
}

if (process.argv.length < 3)
{
    console.log(`Usage: ${process.argv[0]} ${process.argv[1]} <path to config.yaml>`);
    process.exit(1);
}

const configPath = process.argv[2]
console.log(`Loading config file: ${configPath}`)
const configFile = fs.readFileSync(configPath, 'utf8')
const config = YAML.parse(configFile)

const floatplane = new Floatplane(); // Create a new API instance.
await floatplane.login({
    username: config['account']['user'],
    password: config['account']['password'],
});

const channelConfigs = config['channels'] as ChannelConfig[]
const subscriptions = await floatplane.user.subscriptions()
const creators = await floatplane.creator.info(subscriptions.map(x => x.creator))
const uniqueCreatorIds = creators.filter(creator => channelConfigs.some(channel => creator.urlname == channel.creator)).map(x => x.id)
const channels = await floatplane.creator.channels(uniqueCreatorIds)

const baseFolder = config['base_folder'] as string
const tmpFolder = config['tmp_folder'] as string
const baseUrl = config['base_url'] as string
const statePath = config['state_path'] as string

const state : State = fs.existsSync(statePath) ? YAML.parse(fs.readFileSync(statePath, 'utf8')) : new State

function filter(post: BlogPost, filter? : FilterConfig) : boolean {
    if (!post.metadata.hasVideo)
        return false

    if (filter?.title !== undefined && new RegExp(filter.title).test(post.title) == false)
        return false

    if (filter?.not_title !== undefined && new RegExp(filter.not_title).test(post.title) == true)
        return false

    if (filter?.min_length !== undefined && filter.min_length > post.metadata.videoDuration)
        return false

    if (filter?.max_length !== undefined && filter.max_length < post.metadata.videoDuration)
        return false

    return true
}

for (const channelConfig of channelConfigs) {
    console.log(`Checking ${channelConfig.title} for new content`)

    const channel = channels.find(x => x.urlname === channelConfig.channel)
    let channelState = state.channels.find(x => x.slug == channelConfig.slug)

    const allPosts = await floatplane.creator.blogPosts(channel?.creator ?? '', {channel: channel?.id, limit: channelConfig.count})
    const posts = allPosts.filter(x => !channelState?.posts.some(y => x.id == y.id) && filter(x, channelConfig.filter))
    
    console.log(`Found ${posts.length} new posts`)

    if (!channelState)
    {
        const creator = (await floatplane.creator.info([channel?.creator ?? '']))[0]
        channelState = new ChannelState();
        channelState.slug = channelConfig.slug
        channelState.url = `https://www.floatplane.com/channel/${creator.urlname}/home/${channel?.urlname}`
        state.channels.push(channelState)
    }

    for (const post of posts) {
        try
        {
            const fileName = path.join(channelConfig.slug, post.id + '.mp3')
            const fullFileName = path.join(baseFolder, fileName)

            if (fs.existsSync(fullFileName))
            {
                console.log(`Skipping already downloaded video with id ${post.id}: ${post.title}`)
            }
            else
            {
                console.log(`New video with id ${post.id}: ${post.title}`)
                const attachment = post.videoAttachments?.at(0) ?? ''
                const video = await floatplane.content.video(attachment)
                const delivery = await floatplane.cdn.delivery('download', video.id)
                const variant = delivery.groups[0].variants.find(x => x.label == channelConfig.quality)
                const url = (delivery.groups[0].origins?.at(0)?.url ?? '') + variant?.url
                const tmpFileName = path.join(tmpFolder, Math.floor((Math.random() * 10000) + 1).toString() + '.mp4')
                if (!fs.existsSync(path.dirname(tmpFileName)))
                {
                    fs.mkdirSync(path.dirname(tmpFileName), { recursive: true})
                }
        
                console.log(`Starting download of video with id ${video.id} to ${tmpFileName}`)
                const downloadRequest = floatplane.got.stream(url);
                // Pipe the download to the file once response starts
                downloadRequest.pipe(fs.createWriteStream(tmpFileName));
                await new Promise((res, rej) => {
                    downloadRequest.on("end", res);
                    downloadRequest.on("error", rej);
                });
                console.log(`Download of video with id ${video.id} finished`)
                if (!fs.existsSync(path.dirname(fullFileName)))
                {
                    fs.mkdirSync(path.dirname(fullFileName), { recursive: true})
                }
                console.log(`Starting conversion of video with id ${video.id}`)
                const convert = ffmpeg(tmpFileName, {}).save(fullFileName)
                await new Promise((res, rej) => {
                    convert.on("end", res);
                    convert.on("error", rej);
                });
                fs.rmSync(tmpFileName)
                console.log(`Conversion of video with id ${video.id} finished`)
            }

            const postState = new PostState();
            postState.title = post.title
            postState.description = post.text
            postState.mp3 = fileName
            postState.id = post.id
            postState.url = `https://www.floatplane.com/post/${post.id}`
            postState.date = post.releaseDate
            postState.duration = post.metadata.videoDuration
            channelState.posts.push(postState)
        }
        catch(e : any)
        {
            console.log(e)
        }
    }

    var feed = new RSS({ 
        title: channelConfig.title, 
        site_url: channelState.url, 
        feed_url: `${baseUrl}/${channelConfig.slug}.xml`, 
        image_url: channelConfig.image, 
        language: channelConfig.language, 
        categories: channelConfig.categories, 
        custom_namespaces: { 'itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd' },
        custom_elements: [{'itunes:image': {_attr: {href: channelConfig.image}}}]
    });

    for (const post of channelState.posts)
    {
        feed.item({
            guid: post.id,
            title: post.title,
            description: post.description,
            url: post.url,
            enclosure: {url: config.base_url + '/' + channelConfig.slug + '/' + post.id + '.mp3'},
            date: post.date,
            custom_elements: post.duration !== undefined ? [{'itunes:duration': new Date(post.duration * 1000).toISOString().slice(11, 19)}] : []
        })
    }

    fs.writeFileSync(path.join(config.base_folder, channelConfig.slug + '.xml'), feed.xml(), 'utf8')
}
fs.writeFileSync(statePath, YAML.stringify(state), 'utf8')
console.log("All finished")
