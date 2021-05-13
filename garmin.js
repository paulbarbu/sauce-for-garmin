/**
TODO: centralise all strings, especially Garmin ones
TODO: other UI languages?
TODO: change activity from the arrows at the top
TODO: Analytics: track downloads
TODO: Full screen
TODO: Buy me a coffee
*/

/**
 * zone - the zone for which you need the intervals on the UI
 * Return: string as seen on the UI
 */
function getGarminZoneInterval(zone)
{
    return document.getElementsByClassName('heart-rate-zones')[0].getElementsByClassName('zones-' + zone)[0].getElementsByClassName('timeInZonesDetails')[0].getElementsByTagName('span')[1].innerText.trim();
}

/**
 * Get the neighbouring limits of a zone read from the UI
 * Neighbouring: always the value touches the next zone (zones 1-4) or the previous zone: where zone 5 touches zone 4
 */
function parseGarminZoneInterval(garminZoneInterval)
{
    // trim strings & filter empty string since the text of the zone intervals may contain redundant white spaces
    const tokens = garminZoneInterval.split(' ').map(x => x.trim()).filter(x => x.length > 0);

    // the penultimate token is always the number before bpm, eg: "> 190 bpm" or "120 - 130 bpm"
    // and thet is our "neighbouring" limit of the zone
    return tokens[tokens.length - 2];
}

function getHRZoneTicks()
{
    var ticks = [];
    // only 4 zones since I need to draw up to first limit, up to second, up to third, up to fourth, above the fourth
    for(let i = 1; i <= 4; ++i)
    {
        const gZoneInterval = getGarminZoneInterval(i);
        const zoneLimit = parseGarminZoneInterval(gZoneInterval);
        ticks.push(zoneLimit);
        console.log(`Zone ${i}: ${gZoneInterval} - limit: ${zoneLimit}`);
    }

    return ticks;
}

/**
 * minHr - on plot
 * maxHr - on plot
 */
function hrZoneTicksToPercentages(ticks, minHr, maxHr)
{
    const range = maxHr - minHr;

    //TODO: in (the unlikely) case the plot's minimum HR reading is above one of the HR zones, the "tick-minHr" computation will be negative, in that case set the percentage to 0
    return ticks.map(tick => (tick-minHr)/range);
}

function createSVGElement(el, attrs)
{
    const svgEl = document.createElementNS("http://www.w3.org/2000/svg", el);
    for(const [attrName, attrVal] of Object.entries(attrs))
    {
        svgEl.setAttribute(attrName, attrVal);
    }

    return svgEl;
}

async function main()
{
    document.getElementById('tabTimeInZonesId').click();
    console.log('Clicked on "Time in Zones"')
    document.getElementById('tabStatsId').click();
    console.log('Clicked on "Stats"')

    // wait for the Time in Zones stats to load
    await new Promise(r => setTimeout(r, 500));

    const ticks = getHRZoneTicks();

    // the position of the HR plot among the other plots
    const gHRPlotPos = [...document.getElementsByClassName('chart-name')].map(el => el.innerText).indexOf('Heart Rate');

    if(gHRPlotPos !== -1)
    {
        const hrPlotLabels = [...document.querySelectorAll('.highcharts-axis-labels.highcharts-yaxis-labels')[gHRPlotPos].children].map(tick => tick.getElementsByClassName('y-axis-label')[0].innerHTML);

        const min = parseInt(hrPlotLabels[0]);
        const max = parseInt(hrPlotLabels.slice(-1));

        if (min > max)
        {
            [min, max] = [max, min];
        }

        // get the HR zones as percentages and add the zone 5 as 100% for drawing purposes
        const percentageHRLimits = [...hrZoneTicksToPercentages(ticks, min, max), 1];
        console.log(`Percentage HR limits: ${percentageHRLimits}`);

        // get the background rect of the plot
        const gHRBgRect = document.getElementsByClassName('highcharts-plot-background')[gHRPlotPos];

        const hrBandsDefs = createSVGElement('defs', {});
        const hrBandsGradient = createSVGElement('linearGradient', {
            'id': 'saucehrbandsoverlay',
            // draw the bands horizontally
            'x1': 0,
            'x2': 0,
            'y1': 1,
            'y2': 0,
        });

        const zonesColors = ['gray', 'blue', 'green', 'orange', 'red'];
        for(var [limit, color] of percentageHRLimits.map((limit, index) => [limit, zonesColors[index]]))
        {
            hrBandsGradient.appendChild(createSVGElement('stop', {
                'offset': limit,
                'stop-color': color,
            }));
        }

        hrBandsDefs.appendChild(hrBandsGradient);

        const hrBandsOverlay = createSVGElement('rect', {
            'x': gHRBgRect.getAttribute('x'),
            'y': gHRBgRect.getAttribute('y'),
            'rx': gHRBgRect.getAttribute('rx'),
            'ry': gHRBgRect.getAttribute('ry'),
            'width': gHRBgRect.getAttribute('width'),
            'height': gHRBgRect.getAttribute('height'),
            'fill': 'url(#saucehrbandsoverlay)',
        });

        // add the HR bands after the background of the HR plot, thus rendering it over the background        
        gHRBgRect.parentNode.insertBefore(hrBandsOverlay, gHRBgRect.nextSibling);
        gHRBgRect.parentNode.insertBefore(hrBandsDefs, gHRBgRect.nextSibling);
    }
    else
    {
        console.log('No HR plot found');
    }
}

main();