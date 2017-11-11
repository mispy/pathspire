import * as _ from 'lodash'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {observable, computed, action} from 'mobx'
import {observer} from 'mobx-react'

import * as d3 from 'd3'
import * as d3_chromatic from 'd3-scale-chromatic'
declare const require: any
const TinyQueue = require('tinyqueue')

declare global {
  interface Window {
    homepageStart: Function
  }
}

const BLANK = "#343434"
const GREEN = "#3BC376"

class PriorityQueue<T> {
    queue: any
    constructor() {
        this.queue = new TinyQueue([], (a: any, b: any) => a.priority - b.priority)
    }

    push(value: T, priority: number) {
        this.queue.push({ value, priority })
    }

    pop(): T {
        return this.queue.pop().value
    }

    get length(): number {
        return this.queue.length
    }
}

class Hex {
    static directions = [
        new Hex(+1, -1, 0), new Hex(+1, 0, -1), new Hex(0, +1, -1),
        new Hex(-1, +1, 0), new Hex(-1, 0, +1), new Hex(0, -1, +1)
    ]

    static zero = new Hex(0, 0, 0)

    static ring(center: Hex, radius: number): Hex[] {
        if (radius == 0) return [center]

        const results: Hex[] = []
        let hex = center.add(Hex.directions[4].scale(radius))
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < radius; j++) {
                results.push(hex)
                hex = hex.neighbor(i)
            }
        }
        return results
    }

    static rings(center: Hex, startRadius: number, endRadius: number) {
        const results = []
        for (let i = startRadius; i < endRadius; i++) {
            results.push(...Hex.ring(center, i))
        }
        return results
    }

    readonly q: number
    readonly r: number
    readonly s: number

    constructor(q: number, r: number, s: number) {
        console.assert(q + r + s == 0)
        this.q = q
        this.r = r
        this.s = s
    }

    add(b: Hex) {
        return new Hex(this.q+b.q, this.r+b.r, this.s+b.s)
    }

    scale(amount: number) {
        return new Hex(this.q*amount, this.r*amount, this.s*amount)
    }

    neighbor(index: number) {
        return this.add(Hex.directions[index])
    }

    equals(b: Hex) {
        return this.key === b.key
    }

    get neighbors() {
        return Hex.directions.map(hex => this.add(hex))
    }

    get key() {
        return `${this.q},${this.r},${this.s}`        
    }
}

class HexGrid<T> {
    @observable cells: Map<string, T> = new Map()

    constructor() {        
    }
    

    get(hex: Hex): T {
        return this.cells.get(hex.key) as T
    }

    set(hex: Hex, value: T) {
        return this.cells.set(hex.key, value)
    }

    forEach(callback: (hex: Hex) => void) {
        return this.cells.forEach((val, key) => {
            const [q, r, s] = key.split(",").map(s => parseInt(s))
            callback(new Hex(q, r, s))
        })
    }
}

function hexagonPoints(cx: number, cy: number, size: number) {
    const path = []
    for (var i = 0; i < 6; i++) {
        const angle = Math.PI/180 * (60*i + 30)
        path.push(Math.round(cx+size*Math.cos(angle))+","+Math.round(cy+size*Math.sin(angle)))
    }
    return path
}

class Cell {
    game: Game
    hex: Hex
    @observable color = BLANK

    constructor(game: Game, hex: Hex) {
        this.game = game
        this.hex = hex
    }

    get neighbors(): Cell[] {
        return this.hex.neighbors.map(hex => this.game.hexGrid.get(hex)).filter(cell => cell)
    }
}

// player is green tile
// moves towards exit (white tile?)
// red tile enemies
// create blue tile barriers to block path of enemies

interface Enemy {
    hex: Hex
}

class Game {
    @observable playerLocation: Hex = new Hex(-3, 6, -3)
    @observable exitLocation: Hex = new Hex(3, -6, 3)
    @observable enemies: Enemy[] = []

    @computed get ringSize() { return 8 }

    @computed get ringHexes() {
        const {ringSize} = this
        return Hex.rings(Hex.zero, 0, ringSize)
    }

    @computed get cells(): Cell[] {
        return this.ringHexes.map(hex => this.hexGrid.get(hex) as Cell)
    }

    hexGrid: HexGrid<Cell>
    constructor() {
        this.hexGrid = new HexGrid<Cell>()
        this.ringHexes.forEach(hex => this.hexGrid.set(hex, new Cell(this, hex)))

        const barrierHexes = Hex.rings(Hex.zero, 0, 2)
        barrierHexes.forEach(hex => this.hexGrid.get(hex).color = "orange")

        const numEnemies = 3
        for (let i = 0; i < numEnemies; i++) {
            this.enemies.push({ hex: (_.sample(this.cells) as Cell).hex })
        }
    }

    path(start: Cell, goal: Cell): Cell[]|undefined {
        const frontier = new PriorityQueue<Cell>()
        frontier.push(start, 0)
        const cameFrom: Map<Cell, Cell|undefined> = new Map()
        const costSoFar: Map<Cell, number> = new Map()
        cameFrom.set(start, undefined)
        costSoFar.set(start, 0)

        while (frontier.length > 0) {
            const current = frontier.pop()

            if (current === goal)
                break;

            current.neighbors.forEach(nextCell => {
                if (nextCell.color !== BLANK) return
                
                const newCost = (costSoFar.get(current)||0) + 1
                const prevCost = costSoFar.get(nextCell)
                if (prevCost === undefined || newCost < prevCost) {
                    costSoFar.set(nextCell, newCost)
                    frontier.push(nextCell, newCost)
                    cameFrom.set(nextCell, current)
                }
            })
        }

        if (!cameFrom.has(goal))
            return undefined
        else {
            const path = [goal]
            let current = goal
            while (current !== start) {
                current = cameFrom.get(current) as Cell
                if (current === start)
                    break;
                path.push(current)
            }
            path.reverse()
            return path
        }
    }

    frame() {
    }
}

@observer
class GameView extends React.Component<{ width: number, height: number }> {
    @computed get game() { return new Game() }
    @computed get screenCenterX() { return this.props.width/2 }
    @computed get screenCenterY() { return this.props.height/2 }
    @computed get hexRadius() { return Math.round(Math.min(this.props.height, this.props.width)/(this.game.ringSize)/4) }

    @observable isMouseDown: boolean = false
    @observable currentSelection: Cell[] = []
    @observable pathTarget: Hex

    timeCounter = 0
    prevTime?: number
    paused: boolean = false
    @action.bound frame(time: number) {
        const deltaTime = time - (this.prevTime||time)
        this.prevTime = time

        const frameInterval = 20
        this.timeCounter += deltaTime
        if (this.timeCounter > frameInterval && !this.paused) {
            this.game.frame()
            this.timeCounter -= frameInterval
        }

        requestAnimationFrame(this.frame)
    }

    componentDidMount() {
        requestAnimationFrame(this.frame)
        window.onkeydown = () => { this.paused = !this.paused }
    }

    @action.bound onMouseDown(hex: Hex) {
        const targetCell = this.game.hexGrid.get(hex)
        this.game.playerLocation = hex
        console.log(hex)
    }

    @action.bound onMouseMove(hex: Hex) {
        const targetCell = this.game.hexGrid.get(hex)
        this.pathTarget = hex

        if (this.currentSelection.length) {
            const initialCell = this.currentSelection[0]

            if (initialCell.hex.neighbors.some(hex => hex.key == targetCell.hex.key)) {
                const color = this.currentSelection[0].color
                this.currentSelection[0].color = targetCell.color
                targetCell.color = color
                this.currentSelection = []
            }
        }
//        if (this.currentSelection.length >= 2)
//            this.currentSelection.forEach(cell => cell.color = BLANK)
//        this.currentSelection = []
    }

    @action.bound onMouseUp(hex: Hex) {
        
    }

    hexToPolygon(hex: Hex): string {
        const {screenCenterX, screenCenterY, hexRadius} = this
        const screenX = screenCenterX + hexRadius * Math.sqrt(3) * (hex.q + hex.r/2)
        const screenY = screenCenterY + hexRadius * 3/2 * hex.r
        return hexagonPoints(screenX, screenY, hexRadius).join(" ")
    }

    renderTerrain() {
        const {game} = this

        return game.cells.map(cell => {
            const hex = cell.hex
            const isSelected = this.currentSelection.indexOf(cell) !== -1
            const isPlayer = hex.equals(game.playerLocation)

            const points = this.hexToPolygon(hex)

            return <polygon onMouseDown={e => this.onMouseDown(hex)} onMouseMove={e => this.onMouseMove(hex)} onMouseUp={e => this.onMouseUp(hex)} points={points} fill={(game.hexGrid.get(hex) as Cell).color} stroke={"#000"} strokeWidth={3}/>
        })
    }

    renderPlayer() {
        const {game} = this
        const points = this.hexToPolygon(game.playerLocation)
        return <polygon points={points} fill="lightgreen"/>
    }

    renderExit() {
        const points = this.hexToPolygon(this.game.exitLocation)
        return <polygon points={points} fill="white"/>
    }

    renderEnemies() {
        return this.game.enemies.map(enemy => {
            const points = this.hexToPolygon(enemy.hex)
            return <polygon points={points} fill="red"/>
        })
    }

    renderPath() {
        const {game} = this
        const path = this.pathTarget && game.path(game.hexGrid.get(game.playerLocation), game.hexGrid.get(this.pathTarget))

        if (path === undefined)
            return

        return path.map(cell => {
            const points = this.hexToPolygon(cell.hex)
            return <polygon points={points} fill="yellow"/>
        })
    }

    render() {
        const {props, screenCenterX, screenCenterY, hexRadius, game} = this

        return <svg width={props.width} height={props.height}>
            {this.renderTerrain()}
            {this.renderPath()}
            {this.renderPlayer()}
            {this.renderExit()}
            {this.renderEnemies()}
        </svg>
    }
}

window.homepageStart = function() {
    function render() {
        ReactDOM.render(<GameView width={window.innerWidth} height={window.innerHeight} />, document.querySelector("#gameulation"))
    }

    window.onresize = render
    render()
}


@observer
export default class Homepage extends React.Component {
	render() {
        return <main>
            <div id="gameulation">
                <script async dangerouslySetInnerHTML={{__html: "window.homepageStart()"}}></script>
            </div>
        </main>
	}
}
