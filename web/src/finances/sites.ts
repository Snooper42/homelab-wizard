// Each brand's website, for Get the real logo (internal/sitelogo): most
// are their name and .com (wellsfargo.com, costco.com); the rest are here.
// A guess the household can change before anything is asked; nothing is
// asked until they click.
import { brands } from './logos';

/** Brands whose website is not their name and .com. */
const sites: Record<string, string> = {
  dukeenergy: 'duke-energy.com', schwab: 'schwab.com', usbank: 'usbank.com', navyfederal: 'navyfederal.org', mtbank: 'mtb.com', redstone: 'redfcu.org',
  disneyplus: 'disneyplus.com', amazonprime: 'amazon.com', amazonprimevideo: 'amazon.com', amazonmusic: 'amazon.com', aws: 'aws.amazon.com', kindle: 'amazon.com',
  googleone: 'one.google.com', microsoft365: 'microsoft.com', tmobile: 't-mobile.com', visiblebyverizon: 'visible.com', googlefi: 'fi.google.com',
  thenewyorktimes: 'nytimes.com', irs: 'irs.gov', applepay: 'apple.com', googlepay: 'pay.google.com', farmers: 'farmers.com', bluecross: 'bcbs.com',
  kaiser: 'kaiserpermanente.org', unitedhealthcare: 'uhc.com', fifththird: '53.com', keybank: 'key.com', santander: 'santanderbank.com', tdbank: 'td.com',
  citizens: 'citizensbank.com', merrill: 'merrilledge.com', citi: 'citi.com', cryptocom: 'crypto.com', googleworkspace: 'workspace.google.com',
  googlefiber: 'fiber.google.com', slingtv: 'sling.com', chickfila: 'chick-fil-a.com', dunkin: 'dunkindonuts.com', seveneleven: '7-eleven.com',
  thehomedepot: 'homedepot.com', amc: 'amctheatres.com', wholefoods: 'wholefoodsmarket.com', xboxgamepass: 'xbox.com', nintendoswitch: 'nintendo.com',
  chatgpt: 'openai.com', fubotv: 'fubo.tv', plex: 'plex.tv', tubi: 'tubitv.com', peacock: 'peacocktv.com', nissan: 'nissanusa.com', aldi: 'aldi.us',
  zoom: 'zoom.us', etrade: 'etrade.com', troweprice: 'troweprice.com', interactivebrokers: 'interactivebrokers.com', traderepublic: 'traderepublic.com',
  barnesandnoble: 'barnesandnoble.com', panerabread: 'panerabread.com', dollargeneral: 'dollargeneral.com', dollartree: 'dollartree.com',
  oldnavy: 'oldnavy.com', pizzahut: 'pizzahut.com', epicgames: 'epicgames.com', boostmobile: 'boostmobile.com', mintmobile: 'mintmobile.com',
  usmobile: 'usmobile.com', rocketmortgage: 'rocketmortgage.com', mrcooper: 'mrcooper.com', edwardjones: 'edwardjones.com', creditkarma: 'creditkarma.com',
  planetfitness: 'planetfitness.com', libertymutual: 'libertymutual.com', statefarm: 'statefarm.com', siriusxm: 'siriusxm.com', ynab: 'ynab.com',
};

/**
 * The website to ask for a logo: a brand's (above, else its name and
 * .com); "" for a name of no known brand (an HOA, a person, a loan called
 * Mortgage), whose website only the household knows.
 */
export function siteFor(brand: string | undefined, _name?: string): string {
  if (!brand || brand === 'none' || !brands[brand]) return '';
  return sites[brand] || brands[brand].name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '') + '.com';
}
