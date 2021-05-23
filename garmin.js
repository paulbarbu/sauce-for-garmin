'use strict';
(function() {
    /**
    TODO: draw the overlay then the activity is changed using the <> button in the top right corner
    TODO: Analytics: track downloads
    TODO: Full screen plot overlay
    TODO: Buy me a coffee
    TODO: other UI languages?
    TODO: button to draw a gradient with fixed bands, so not really a gradient
    TODO: CD: commit=deploy/publish extension (via github actions?)
    */

    // contains the user's HR zones, needs to be clicked to load its contents
    const G_HR_ZONES_TAB_ID = 'tabTimeInZonesId';

    // the element holding the user's HR zones
    const G_HR_ZONES_CLASS = 'heart-rate-zones';

    // the initial tab that is loaded by Garmin on an activity's page
    const G_STATS_TAB_ID = 'tabStatsId';

    // the name/title of the HR plot, ie. the one to be overlaid with the zones bands
    const G_HR_PLOT_NAME = 'Heart Rate';

    // the prefix of the class that identifies each HR zone
    const G_HR_ZONE_CLASS_PREFIX = 'zones-';

    const G_HR_ZONE_TEXT_CLASS = 'timeInZonesDetails';

    // unique id for the gradient to be used on the overlay
    const OVERLAY_GRADIENT_ID = 'saucehrbandsoverlay';

    // the class that identifies the plots on an activity's page
    const G_PLOTS_CLASS = 'chart-name';

    // the query selector for all the y axis labels of the HighCharts plots
    const HC_YAXIS_QUERY_SELECTOR = '.highcharts-axis-labels.highcharts-yaxis-labels';

    // the class of the elements holding the Y axis' text labels in HighCharts
    const HC_YAXIS_LABEL_CLASS = 'y-axis-label';

    // the class for a HighCharts plot
    const HC_PLOT_BG_CLASS = 'highcharts-plot-background';

    // the element's class to be observed by the MutationObserver
    // this is needed in order to display the HR overlay regardless of how the user got to the activity's page
    const G_OBSERVED_ELEMENT_CLASS = 'main-body';

    /**
     * Indefinitely wait for an element on the page to be available, if the element is available, return immediately
     * @param {string} id the element's id to wait for
     */
    async function waitForElementId(id)
    {
        while(document.getElementById(id) === null)
        {
            // wait 100 ms
            await new Promise(r => setTimeout(r, 100));
        }
    }

    /**
     * Indefinitely wait for an element on the page to be available, if the element is available, return immediately
     * @param {string} cls the element's class to wait for
     */
     async function waitForElementClass(cls)
     {
         while(document.getElementsByClassName(cls).length === 0)
         {
             // wait 100 ms
             await new Promise(r => setTimeout(r, 100));
         }
     }

    /**
     * zone - the zone for which you need the intervals on the UI
     * Return: string as seen on the UI
     */
    function getGarminZoneInterval(zone)
    {
        return document.getElementsByClassName(G_HR_ZONES_CLASS)[0]
            .getElementsByClassName(G_HR_ZONE_CLASS_PREFIX + zone)[0]
            .getElementsByClassName(G_HR_ZONE_TEXT_CLASS)[0]
            .getElementsByTagName('span')[1].innerText.trim();
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
            console.debug(`Zone ${i}: ${gZoneInterval} - limit: ${zoneLimit}`);
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
        return ticks.map(tick => (tick-minHr)/range)
            .map(p => Math.min(p, 1)); // there should be no higher than 100% percentages (can be the case if the plot's max HR is below zones 5 or 4)
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

    async function renderHrOverlay()
    {
        await waitForElementId(G_HR_ZONES_TAB_ID);

        document.getElementById(G_HR_ZONES_TAB_ID).click();
        console.debug('Clicked on "Time in Zones"')
        document.getElementById(G_STATS_TAB_ID).click();
        console.debug('Clicked on "Stats"')

        // wait for the Time in Zones tab to load
        await waitForElementClass(G_HR_ZONES_CLASS);
        const ticks = getHRZoneTicks();

        // the position of the HR plot among the other plots
        const gHRPlotPos = [...document.getElementsByClassName(G_PLOTS_CLASS)]
            .map(el => el.innerText).indexOf(G_HR_PLOT_NAME);

        if(gHRPlotPos !== -1)
        {
            const hrPlotLabels = [...document.querySelectorAll(HC_YAXIS_QUERY_SELECTOR)[gHRPlotPos].children]
                .map(tick => tick.getElementsByClassName(HC_YAXIS_LABEL_CLASS)[0].innerHTML);

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
            const gHRBgRect = document.getElementsByClassName(HC_PLOT_BG_CLASS)[gHRPlotPos];

            const hrBandsDefs = createSVGElement('defs', {});
            const hrBandsGradient = createSVGElement('linearGradient', {
                'id': OVERLAY_GRADIENT_ID,
                // draw the bands horizontally, from the bottom to the top
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
                'rx': gHRBgRect.getAttribute('rx'), // future-proof, not used by Garmin at the moment
                'ry': gHRBgRect.getAttribute('ry'), // future-proof, not used by Garmin at the moment
                'width': gHRBgRect.getAttribute('width'),
                'height': gHRBgRect.getAttribute('height'),
                'fill': `url(#${OVERLAY_GRADIENT_ID})`,
            });

            // add the HR bands after the background of the HR plot, thus rendering it over the background        
            gHRBgRect.parentNode.insertBefore(hrBandsOverlay, gHRBgRect.nextSibling);
            gHRBgRect.parentNode.insertBefore(hrBandsDefs, gHRBgRect.nextSibling);
        }
        else
        {
            console.info('No HR plot found, hidden by user');
        }
    }

    async function main()
    {   
        await waitForElementClass(G_OBSERVED_ELEMENT_CLASS);
        const targetNode = document.getElementsByClassName(G_OBSERVED_ELEMENT_CLASS)[0];
        const config = { attributes: false, childList: true, subtree: true };

        // Callback function to execute when mutations are observed
        const callback = async function(mutationsList, observer) {
            for(const mutation of mutationsList) {
                if (mutation.type === 'childList')
                {
                    for(var addedChild of mutation.addedNodes)
                    {
                        console.debug(`Added node ${addedChild} has id ${addedChild.id} and is of type ${addedChild.tagName}`);
                        // look for plots
                        if(addedChild.tagName === 'svg')
                        {
                            console.debug('Triggering a HR overlay rendering');
                            // rendering this on any SVG works fine since the function waits on the needed elements to become available
                            // the downside is that it will be called multiple times
                            renderHrOverlay();

                            return;
                        }
                    }
                }
            }
        };

        const observer = new MutationObserver(callback);

        // Start observing the target node for configured mutations
        observer.observe(targetNode, config);
    }

    main();
})();