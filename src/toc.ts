import { Diagnoser } from './diagnostic'
import { NavDocument, NavOl, NavPoint, NcxDocument, PageTarget, Unvalidated } from './model'

export type TocItem = {
    label: string,
    href: string,
    level: number,
}
export type Toc = {
    title?: string,
    items: TocItem[],
}
export function extractTocFromNcx(ncx: Unvalidated<NcxDocument>, diags: Diagnoser): Toc | undefined {
    const navMap = ncx.ncx?.[0]?.navMap
    if (navMap == undefined || navMap.length == 0) {
        const pageLists = ncx.ncx?.[0]?.pageList
        if (pageLists == undefined || pageLists.length == 0) {
            diags.push({
                message: 'ncx is missing navMap and pageList',
                data: ncx,
            })
            return undefined
        }
        if (pageLists.length > 1) {
            diags.push({
                message: 'ncx has multiple pageLists',
                data: ncx,
            })
        }
        const pageList = pageLists[0]
        if (!pageList.pageTarget?.length) {
            diags.push({
                message: 'ncx pageList is missing pageTargets',
                data: ncx,
            })
            return undefined
        }
        const title = pageList.navLabel?.[0]?.text?.[0]?.['#text']
        return {
            title,
            items: [...pageListIterator(pageList.pageTarget, diags)],
        }
    } else {
        if (navMap.length > 1) {
            diags.push({
                message: 'ncx has multiple navMaps',
                data: ncx,
            })
        }
        const navPoints = navMap[0].navPoint
        if (navPoints == undefined || navPoints.length == 0) {
            diags.push({
                message: 'ncx navMap is missing navPoints',
                data: ncx,
            })
            return undefined
        }
        const title = ncx.ncx?.[0]?.docTitle?.[0]?.text?.[0]?.['#text']
        return {
            title,
            items: [...navPointsIterator(navPoints, 0, diags)],
        }
    }
}

function* navPointsIterator(navPoints: Unvalidated<NavPoint>[], level: number, diags: Diagnoser): Generator<TocItem> {
    for (const navPoint of navPoints) {
        const label = navPoint.navLabel?.[0]?.text?.[0]?.['#text']
        if (label == undefined) {
            diags.push({
                message: 'navPoints navPoint is missing label',
                data: navPoint,
            })
            continue
        }
        const src = navPoint.content?.[0]?.['@src']
        if (src == undefined) {
            diags.push({
                message: 'navPoints navPoint is missing content src',
                data: navPoint,
            })
            continue
        }
        yield {
            label,
            href: src,
            level,
        }
        const children = navPoint.navPoint
        if (children) {
            yield* navPointsIterator(children, level + 1, diags)
        }
    }
}

function* pageListIterator(pageTargets: Unvalidated<PageTarget>[], diags: Diagnoser): Generator<TocItem> {
    for (const pageTarget of pageTargets) {
        const label = pageTarget.navLabel?.[0]?.text?.[0]?.['#text']
        if (label == undefined) {
            diags.push({
                message: 'pageList pageTarget is missing label',
                data: pageTarget,
            })
            continue
        }
        const src = pageTarget.content?.[0]?.['@src']
        if (src == undefined) {
            diags.push({
                message: 'pageList pageTarget is missing content src',
                data: pageTarget,
            })
            continue
        }
        yield {
            label,
            href: src,
            level: 0,
        }
    }
}

export function extractTocFromNav(document: Unvalidated<NavDocument>, diags: Diagnoser): Toc | undefined {
    const nav = document?.html?.[0]?.body?.[0]?.nav?.[0]
    if (nav === undefined) {
        diags.push({
            message: 'nav is missing',
            data: document,
        })
        return undefined
    }
    const headerElement = nav.h1 ?? nav.h2 ?? nav.h3 ?? nav.h4 ?? nav.h5 ?? nav.h6
    const title = headerElement?.[0]?.['#text']
    const ol = nav.ol
    if (ol === undefined) {
        diags.push({
            message: 'nav is missing ol',
            data: nav,
        })
        return undefined
    }
    return {
        title,
        items: [...olIterator(ol, 0, diags)],
    }
}

function* olIterator(lis: Unvalidated<NavOl>[], level: number, diags: Diagnoser): Generator<TocItem> {
    for (const { li } of lis) {
        if (li == undefined) {
            continue
        }
        const anchor = li[0]?.a?.[0]
        if (anchor == undefined) {
            diags.push({
                message: 'nav ol li is missing anchor',
                data: li,
            })
            continue
        }
        const { '@href': href, '#text': label } = anchor
        if (href == undefined) {
            diags.push({
                message: 'nav ol li is missing href',
                data: li,
            })
            continue
        }
        if (label == undefined) {
            diags.push({
                message: 'nav ol li is missing label',
                data: li,
            })
            continue
        }
        yield {
            label,
            href,
            level,
        }
        const children = li[0].ol
        if (children) {
            yield* olIterator(children, level + 1, diags)
        }
    }
}