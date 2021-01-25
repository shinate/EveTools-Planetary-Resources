import got from 'got'
import { map, keys, uniq, keyBy, has, values, find, mapValues, groupBy, orderBy, merge, filter } from 'lodash'
import regionList from './src/region'
import resourceList from './src/resource'
import { sleep } from 'deasync'
import fs from 'fs'
import cheerio from 'cheerio'

// let rl2 = keyBy(resourceList2, 0)
// console.log(values(mapValues(keyBy(resourceList, 'name'), (v, k) => {
//   v.key = rl2[k][1]
//   return v
// })))
//
// process.exit()

(async () => {

  const base = 'C-7SBM'
  const regionName = '逑瑞斯'
  const { id: r_id, name: r_name } = find(regionList, { name: regionName })

  let resData = fs.existsSync(`dist/region_resource_${r_id}.json`)
    ? JSON.parse(fs.readFileSync(`dist/region_resource_${r_id}.json`).toString())
    : []

  if (resData.length === 0) {

    let resRoute = fs.existsSync('dist/resRoute.json')
      ? JSON.parse(fs.readFileSync('dist/resRoute.json').toString())
      : {}

    if (!resRoute[base]) {
      resRoute[base] = {}
    }

    for (let resourceIndex = 0; resourceIndex < resourceList.length; resourceIndex++) {

      const { name, id, key } = resourceList[resourceIndex]

      // let searchParams = new URLSearchParams({
      //   r_id     : [ r_id ],
      //   p_type_id: [ id ]
      // });

      let searchParams = `r_id[]=${r_id}&p_type_id[]=${id}`

      console.log('Get resource data: ', name)
      // console.log(searchParams)

      let result = []

      try {
        result = await got('https://api-ieve.yiilib.com/v1/planets', {
          searchParams
        }).json()
      } catch (e) {
        console.log(e)
      }

      result = map(result, plant => {
        return {
          resource  : name,
          product   : plant[`p_${key}_cnt`],
          solar     : plant.pSolarSystem.ss_titleEn,
          solarCN   : plant.pSolarSystem.ss_title,
          plantTitle: plant.p_title
        }
      })

      resData = [ ...resData, ...result ]

      let solars = uniq(map(result, ({ solar }) => solar))

      for (let si = 0; si < solars.length; si++) {
        let solar = solars[si]

        if (has(resRoute[base], solar)) {
          continue
        }

        // let searchParams = new URLSearchParams({
        //   startSystemName: base,
        //   endSystemName  : solar,
        //   comparisonType : 'faster',
        //   gateJumpTo     : 255
        // })
        //
        // console.log('Get route data: ', base, solar)
        //
        // let result = await got('https://everoute.net/index.php', {
        //   searchParams
        // })

        let jump = 0

        if (base !== solar) {

          let result = await got(`https://evemaps.dotlan.net/route/${base}:${solar}`)

          let $ = cheerio.load(result.body)
          jump = $('.tablelist tr').length - 2
          jump = jump < 0 ? 0 : jump

          // let jump = result.body.match(/<a href="([^"]+)"[^>]*>Show on/)[1].split(/:/).length - 2
        }

        console.log(`${base} => ${solar} : ${jump}`)
        resRoute[base][solar] = jump

        fs.writeFileSync('dist/resRoute.json', JSON.stringify(resRoute, null, 2))

        sleep(2000)
      }

      sleep(1000)
    }

    resData = resData.map(item => {
      item.jump = resRoute[base][item.solar]
      return item
    })

    fs.writeFileSync(`dist/region_resource_${r_id}.json`, JSON.stringify(resData, null, 2))
  }

  let data_limit_none = [], data_limit_10 = []

  mapValues(groupBy(resData, 'resource'), (list, resource) => {
    let l_limit_none = merge([], Array(6).fill(null), orderBy(list, [ 'product' ], [ 'desc' ]).slice(0, 6))
    data_limit_none.push(...l_limit_none.map(item => {
      return item === null ? `${resource},"-",,,,` : values(item).join(',')
    }))
    let l_limit_10 = merge([], Array(6).fill(null), orderBy(filter(list, ({ jump }) => jump <= 10), [ 'product' ], [ 'desc' ]).slice(0, 6))
    data_limit_10.push(...l_limit_10.map(item => {
      return item === null ? `${resource},"-",,,,` : values(item).join(',')
    }))
  })

  fs.writeFileSync(`dist/region_resource_${r_id}_limit_none.csv`, data_limit_none.join('\n'))
  fs.writeFileSync(`dist/region_resource_${r_id}_limit_10.csv`, data_limit_10.join('\n'))

  // fs.writeFileSync('dist/data.csv', resData)

})()