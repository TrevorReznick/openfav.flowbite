import fs from 'node:fs'
import os from 'node:os'

import configBuilder from './configBuilder'
import loadConfig from './loadConfig'

export default ({ config: _themeConfig = 'src/config.yaml' } = {}) => {
    let cfg;
    return {
      name: 'openfav-integration',
  
      hooks: {
        'astro:config:setup': async ({
          // command,
          config,
          // injectRoute,
          // isRestart,
          logger,
          updateConfig,
          addWatchFile,
        }) => {
          const buildLogger = logger.fork('openfav');
  
          const virtualModuleId = 'openfav:config';
          const resolvedVirtualModuleId = '\0' + virtualModuleId;
  
          const rawJsonConfig = await loadConfig(_themeConfig);
          const { SITE, METADATA, ANALYTICS } = configBuilder(rawJsonConfig);
  
          updateConfig({
            site: SITE.site,
            base: SITE.base,
  
            trailingSlash: SITE.trailingSlash ? 'always' : 'never',
  
            vite: {
              plugins: [
                {
                  name: 'vite-plugin-openfav-config',
                  resolveId(id) {
                    if (id === virtualModuleId) {
                      return resolvedVirtualModuleId;
                    }
                  },
                  load(id) {
                    if (id === resolvedVirtualModuleId) {
                      return `
                      export const SITE = ${JSON.stringify(SITE)};
                      export const METADATA = ${JSON.stringify(METADATA)};                      
                      export const ANALYTICS = ${JSON.stringify(ANALYTICS)};
                      `;
                    }
                  }
                }
              ]
            }
          })
  
          if (typeof _themeConfig === 'string') {
            addWatchFile(new URL(_themeConfig, config.root));
  
            buildLogger.info(`openfav \`${_themeConfig}\` has been loaded.`);
          } else {
            buildLogger.info(`openfav config has been loaded.`);
          }
        },
        'astro:config:done': async ({ config }) => {
          cfg = config;
        },
  
        'astro:build:done': async ({ logger }) => {
          const buildLogger = logger.fork('openfav');
          buildLogger.info('Updating `robots.txt` with `sitemap-index.xml` ...');
  
          try {
            const outDir = cfg.outDir;
            const publicDir = cfg.publicDir;
            const sitemapName = 'sitemap-index.xml';
            const sitemapFile = new URL(sitemapName, outDir);
            const robotsTxtFile = new URL('robots.txt', publicDir);
            const robotsTxtFileInOut = new URL('robots.txt', outDir);
  
            const hasIntegration =
              Array.isArray(cfg?.integrations) &&
              cfg.integrations?.find((e) => e?.name === '@astrojs/sitemap') !== undefined;
            const sitemapExists = fs.existsSync(sitemapFile);
  
            if (hasIntegration && sitemapExists) {
              const robotsTxt = fs.readFileSync(robotsTxtFile, { encoding: 'utf8', flag: 'a+' });
              const sitemapUrl = new URL(sitemapName, String(new URL(cfg.base, cfg.site)));
              const pattern = /^Sitemap:(.*)$/m;
  
              if (!pattern.test(robotsTxt)) {
                fs.appendFileSync(robotsTxtFileInOut, `${os.EOL}${os.EOL}Sitemap: ${sitemapUrl}`, {
                  encoding: 'utf8',
                  flag: 'w',
                });
              } else {
                fs.writeFileSync(robotsTxtFileInOut, robotsTxt.replace(pattern, `Sitemap: ${sitemapUrl}`), {
                  encoding: 'utf8',
                  flag: 'w',
                });
              }
            }
          } catch (err) {
            /* empty */
          }
        }
      }
    }
  }