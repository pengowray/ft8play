const deofficializationTable = {
  'Fed. Rep. of Germany': 'Germany',
  'Republic of Korea': 'South Korea',
  'DPR of Korea': 'North Korea',
  'Republic of South Sudan': 'South Sudan',
  'Republic of Kosovo': 'Kosovo',
  'Dem. Rep. of the Congo': 'Democratic Republic of the Congo',
  'Kingdom of Eswatini': 'Eswatini',
  'United Arab Emirates': 'UAE',
  'Sov Mil Order of Malta': 'Order of Malta', // Sovereign Military Order of Malta
  'Timor - Leste': 'East Timor',
  'The Gambia': 'Gambia',
  'Czech Republic': 'Czechia',
  'Slovak Republic': 'Slovakia',
  'Brunei Darussalam': 'Brunei',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
  'Trinidad & Tobago': 'Trinidad and Tobago',
  'Sao Tome & Principe': 'São Tomé and Príncipe',
  'St. Kitts & Nevis': 'Saint Kitts and Nevis',
  'Antigua & Barbuda': 'Antigua and Barbuda',
  
  //islands
  'Amsterdam & St. Paul Is.': 'Amsterdam and Saint Paul Islands',
  'Andaman & Nicobar Is.': 'Andaman and Nicobar Islands',
  'N.Z. Subantarctic Is.': 'New Zealand Subantarctic Islands',
  'Pr. Edward & Marion Is.': 'Prince Edward and Marion Islands',
};

const cleanupRegexPatterns = [
  { pattern: /\s&\s/g, replacement: ' and ' },
  { pattern: /\bSt\./g, replacement: 'Saint' },
  // { pattern: /\bIs\./g, replacement: 'Islands' }, // island or islands?
];

function TidyCountry(country) {
  if (!country) return null;
  let name = country.trim();
  if (deofficializationTable[name]) {
    name = deofficializationTable[name];
  }

  return cleanupRegexPatterns.reduce((name, { pattern, replacement }) => 
    name.replace(pattern, replacement), name);
}

  

class CTYData {
  constructor() {
    this.countryData = [];
    this.prefixTrie = {};
    this.countries = []; // for debug only
  }

  async loadData() {
    return this.readAndParseCTY('data/cty.csv');
  }

  async readAndParseCTY(filePath) {
    try {
      const response = await fetch(filePath);
      const text = await response.text();
      this.parseCTYContent(text);
      this.buildPrefixTrie();
    } catch (error) {
      console.error('Error reading CTY file:', error);
    }
  }

  buildPrefixTrie() {
    this.countryData.forEach(country => {
      this.addToTrie(country.prefix, country);
      country.aliases.forEach(alias => {
        if (alias.startsWith('=')) {
          this.addToTrie(alias.slice(1), country, true);
        } else {
          this.addToTrie(alias, country);
        }
      });
    });
  }

  addToTrie(prefix, country, exactMatch = false) {
    let node = this.prefixTrie;
    for (const char of prefix) {
      if (!node[char]) node[char] = {};
      node = node[char];
    }
    if (!node.countries) node.countries = [];
    node.countries.push({ country, exactMatch });
  }

  parseCTYContent(content) {
    const lines = content.split('\n');
    let currentCountry = null;

    lines.forEach(line => {
      line = line.trim();
      if (line) {
        const parts = this.splitCSVLine(line);
        if (parts.length >= 9) {
          currentCountry = this.parseCountryLine(parts);
          
          //tidy country name
          const tidyCountry = TidyCountry(currentCountry.country);
          currentCountry.country = tidyCountry;
          //this.countries.push([currentCountry.country, tidyCountry]); // for debug

          this.countryData.push(currentCountry);
        } else if (currentCountry) {
          this.parseAliasPrefixes(line, currentCountry);
        }
      }
    });
  }

  splitCSVLine(line) {
    const parts = [];
    let part = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuotes = !inQuotes;
      } else if (line[i] === ',' && !inQuotes) {
        parts.push(part.trim());
        part = '';
      } else {
        part += line[i];
      }
    }
    if (part.endsWith(';')) part = part.slice(0, -1);
    parts.push(part.trim());
    return parts;
  }

  parseCountryLine(parts) {
    return {
        prefix: parts[0],
        country: parts[1],
        dxcc: parseInt(parts[2]),
        continent: parts[3],
        cq: parseInt(parts[4]), // cq zone
        itu: parseInt(parts[5]), // itu zone
        latitude: parseFloat(parts[6]),
        longitude: parseFloat(parts[7]),
        timeOffset: parseFloat(parts[8]),
        aliases: parts[9].split(' ').map(alias => alias.trim())
      };
    }

  parseAliasPrefixes(line, country) {
    const aliases = line.split(',').map(alias => alias.trim());
    country.aliases = country.aliases.concat(aliases.filter(alias => alias !== ';'));
  }

  getCountryDetails_Simple(callsign) {
    for (const country of this.countryData) {
      if (this.matchCallsign(callsign, country)) {
        return country;
      }
    }
    return null;
  }

  getCountryDetails(callsign) {
    callsign = callsign.toUpperCase();
    let node = this.prefixTrie;
    let lastMatchingNode = null;
    let exactMatch = null;

    for (const char of callsign) {
      if (!node[char]) break;
      node = node[char];
      if (node.countries) {
        lastMatchingNode = node;
        exactMatch = node.countries.find(c => c.exactMatch && c.country.aliases.includes('=' + callsign));
        if (exactMatch) break;
      }
    }

    if (exactMatch) return exactMatch.country;
    if (lastMatchingNode) {
      // Return the country with the longest matching prefix
      return lastMatchingNode.countries.reduce((a, b) => 
        (a.country.prefix.length > b.country.prefix.length) ? a : b
      ).country;
    }
    return null;
  }

  matchCallsign(callsign, country) {
    if (callsign.startsWith(country.prefix)) {
      return true;
    }
    for (const alias of country.aliases) {
      if (alias.startsWith('=')) {
        if (callsign === alias.slice(1)) {
          return true;
        }
      } else if (callsign.startsWith(alias)) {
        return true;
      }
    }
    return false;
  }
}

const cty = new CTYData();
cty.loadData();
//console.log('countries', cty.countries);