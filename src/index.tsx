//import 'babel-polyfill'
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import {Helmet, HelmetData} from 'react-helmet'
import Homepage from './Homepage'

declare var require: any
const faviconImg = require('./favicon.png')
const styles = require('./index.css')

class Body extends React.Component<{path: string, assets: string[]}> {
    content() {
        const {path} = this.props

        if (path == "/") {
            return <Homepage/>
        }           
    }

    render() {
        const {assets} = this.props
        const js = assets.filter(value => value.match(/\.js$/))

        return <body>
            <Helmet title="Spire of the Path"/>
            {js.map(path =>
                <script src={'/'+path}/>  
            )}
            {this.content()}
        </body>
    }
}

class Head extends React.Component<{path: string, assets: string[], head: HelmetData}> {
    render() {
        const {head, assets, path} = this.props
        const css = assets.filter(value => value.match(/\.css$/))

        const description = `A little puzzle roguelike game on a hexagonal grid.`

        return <head>
            {head.title.toComponent()}
            <meta name="viewport" content="width=device-width, initial-scale=1"/>
            <meta name="description" content={description}/>
            {/*<meta name="twitter:title" content={head.title.toString()}/>
            <meta name="twitter:url" content={"https://mispy.me" + path}/>
            <meta name="twitter:description" content={description}/>
            <meta name="twitter:image" content={"https://mispy.me/" + sunflowerImg}/>
            <meta name="twitter:card" content="summary_large_image"/>*/}

            {/*<meta property="og:locale" content="en_US"/>
            <meta property="og:site_name" content="Jaiden Mispy"/>
            <meta property="og:title" content="Jaiden Mispy"/>
            <meta property="og:url" content={"https://mispy.me" + path}/>
            <meta property="og:description" content={description}/>
            <meta property="og:image" content={"https://mispy.me/" + sunflowerImg}/>*/}
            {head.meta.toComponent()}
            {css.map(cssPath =>
                <link rel="stylesheet" type="text/css" href={'/'+cssPath}/>  
            )}       
            <link rel="icon" href={faviconImg}/>         
            {head.link.toComponent()}
        </head>
    }
}

export default (locals: any, callback: (val: null, html: string) => void) => {
    const assets = Object.keys(locals.webpackStats.compilation.assets)
    const bodyStr = ReactDOMServer.renderToString(<Body path={locals.path} assets={assets}/>)
    const head = Helmet.renderStatic()
    const headStr = ReactDOMServer.renderToString(<Head path={locals.path} head={head} assets={assets}/>)

    callback(null, "<html>"+headStr+bodyStr+"</html>")
};