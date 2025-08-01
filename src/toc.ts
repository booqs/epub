import { Diagnoser } from './common'
import { NavDocument, NavElement, NavOl, NavPoint, NcxDocument, PageTarget } from './model'
import { UnvalidatedXml } from './xml'

export type NavigationItem = {
    label: string,
    href: string,
    level: number,
}
export type Navigation = {
    title?: string,
    type: string | undefined,
    role?: string,
    source: 'ncx' | 'nav',
    items: NavigationItem[],
}
export function extractTocNavigationFromNcx(ncx: UnvalidatedXml<NcxDocument>, diags?: Diagnoser): Navigation | undefined {
    const navMap = ncx.ncx?.[0]?.navMap
    if (navMap == undefined || navMap.length == 0) {
        const pageLists = ncx.ncx?.[0]?.pageList
        if (pageLists == undefined || pageLists.length == 0) {
            diags?.push({
                message: 'ncx is missing navMap and pageList',
                data: ncx,
            })
            return undefined
        }
        if (pageLists.length > 1) {
            diags?.push({
                message: 'ncx has multiple pageLists',
                data: ncx,
            })
        }
        const pageList = pageLists[0]
        if (!pageList.pageTarget?.length) {
            diags?.push({
                message: 'ncx pageList is missing pageTargets',
                data: ncx,
            })
            return undefined
        }
        const title = pageList.navLabel?.[0]?.text?.[0]?.['#text']
        return {
            title,
            type: 'toc',
            source: 'ncx',
            items: [...pageListIterator(pageList.pageTarget, diags)],
        }
    } else {
        if (navMap.length > 1) {
            diags?.push({
                message: 'ncx has multiple navMaps',
                data: ncx,
            })
        }
        const navPoints = navMap[0].navPoint
        if (navPoints == undefined || navPoints.length == 0) {
            diags?.push({
                message: 'ncx navMap is missing navPoints',
                data: ncx,
            })
            return undefined
        }
        const title = ncx.ncx?.[0]?.docTitle?.[0]?.text?.[0]?.['#text']
        return {
            title,
            type: 'toc',
            source: 'ncx',
            items: [...navPointsIterator(navPoints, 0, diags)],
        }
    }
}

function* navPointsIterator(navPoints: UnvalidatedXml<NavPoint>[], level: number, diags?: Diagnoser): Generator<NavigationItem> {
    for (const navPoint of navPoints) {
        const label = navPoint.navLabel?.[0]?.text?.[0]?.['#text']
        if (label == undefined) {
            diags?.push({
                message: 'navPoints navPoint is missing label',
                data: navPoint,
            })
            continue
        }
        const src = navPoint.content?.[0]?.['@src']
        if (src == undefined) {
            diags?.push({
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

function* pageListIterator(pageTargets: UnvalidatedXml<PageTarget>[], diags?: Diagnoser): Generator<NavigationItem> {
    for (const pageTarget of pageTargets) {
        const label = pageTarget.navLabel?.[0]?.text?.[0]?.['#text']
        if (label == undefined) {
            diags?.push({
                message: 'pageList pageTarget is missing label',
                data: pageTarget,
            })
            continue
        }
        const src = pageTarget.content?.[0]?.['@src']
        if (src == undefined) {
            diags?.push({
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

export function extractTocNavigationFromNav(document: UnvalidatedXml<NavDocument>, diags: Diagnoser): Navigation | undefined {
    const nav = document?.html?.[0]?.body?.[0]?.nav?.find(n => n['@type'] === 'toc')
    if (nav === undefined) {
        diags.push({
            message: 'nav is missing',
            data: document,
        })
        return undefined
    }
    return extractNavigationFromNavElement(nav, diags)
}

export function extractNavigationsFromNav(document: UnvalidatedXml<NavDocument>, diags?: Diagnoser): Navigation[] {
    const elements = document?.html?.[0]?.body?.[0]?.nav
    return elements?.map(nav => 
        extractNavigationFromNavElement(nav, diags)
    ).filter(nav => nav !== undefined) ?? []
}

function extractNavigationFromNavElement(nav: UnvalidatedXml<NavElement>, diags?: Diagnoser): Navigation | undefined {
    const headerElement = nav.h1 ?? nav.h2 ?? nav.h3 ?? nav.h4 ?? nav.h5 ?? nav.h6
    const title = headerElement?.[0]?.['#text']
    const ol = nav.ol
    if (ol === undefined) {
        diags?.push({
            message: 'nav is missing ol',
            data: nav,
        })
        return undefined
    }
    return {
        title,
        type: nav['@type'],
        role: nav['@role'],
        source: 'nav',
        items: [...olIterator(ol, 0, diags)],
    }
}

function* olIterator(ols: UnvalidatedXml<NavOl>[], level: number, diags?: Diagnoser): Generator<NavigationItem> {
    for (const { li: lis } of ols) {
        if (lis == undefined) {
            continue
        }
        for (const li of lis) {
            const a = li.a?.[0]
            if (a == undefined) {
                diags?.push({
                    message: 'nav ol li is missing anchor',
                    data: li,
                })
                continue
            }
            const { '@href': href, '#text': label } = a
            if (href == undefined) {
                diags?.push({
                    message: 'nav ol li is missing href',
                    data: li,
                })
                continue
            }
            if (label == undefined) {
                diags?.push({
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
            const children = li.ol
            if (children) {
                yield* olIterator(children, level + 1, diags)
            }
        }
    }
}