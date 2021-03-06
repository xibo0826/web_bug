const http = require('https')
const fs = require('fs')
const cheerio = require('cheerio')
const target_url =
  'https://auctions.yahoo.co.jp/search/search?va=%E9%99%B6%E7%A3%81%E5%99%A8&exflg=1&b=1&n=50&s1=bids&o1=a&rc_ng=1&auccat=&tab_ex=commerce&ei=utf-8&aq=-1&oq=&sc_i=&exflg=1&p=%E9%99%B6%E7%A3%81%E5%99%A8&x=32&y=31'

const MAX_DATA_PAGE = 300
const GET_DATA_SWICH = 1

let pageCnt = 1

// 网络请求
httpGet = async (url) => {
  let text = await new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        const { statusCode } = res
        if (statusCode !== 200) {
          res.resume()
          reject('请求失败')
        }
        let html = ''
        let cnt = 0
        res.on('data', (chunk) => {
          html += chunk
          cnt++
        })
        res.on('end', () => {
          resolve(html)
        })
      })
      .on('error', (err) => {
        reject(err.message)
      })
  })

  return text
}

// 开始爬取
httpGet(target_url).then((html) => {
  try {
    // 删除上次数据
    fs.unlinkSync('data.csv')
  } catch (e) {
    console.error(e.message)
  }

  // 开始爬取当页数据
  httpListPageData(html)
})

// 爬取列表页面数据
httpListPageData = (html) => {
  try {
    if (pageCnt > MAX_DATA_PAGE) {
      return
    }

    console.log(`开始爬取第${pageCnt}页数据`)
    const $ = cheerio.load(html)

    // 爬取当页对象取得
    if (GET_DATA_SWICH) {
      const targets = $(
        '.Products__items .Product .Product__detail .Product__title .Product__titleLink'
      )
      // 爬取对象循环
      targets.each(async (i, el) => {
        // console.log($(this).attr('title') + ' ' + $(this).attr('href'))
        // 获取详细URL
        const detailURL = el.attribs.href
        if (detailURL) {
          // 请求详细页面
          const detailHTML = await httpGet(detailURL)
          // 解析详细页面, 获取结果
          const data = httpDetailPageData(detailHTML, detailURL)
          // 写入文件
          writeData(data)
        }
      })
    }

    // 获取下一页链接
    const nextBtn = $('.Pager__list--next .Pager__link--disable')

    if (nextBtn.length > 0) {
      // 下一页按钮不可用,爬取结束
      return
    } else {
      // 获取下一页URL
      const nextURL = $('.Pager__list--next a').attr('href')
      console.log(nextURL)

      pageCnt++

      // 开始爬取下一页数据
      httpGet(nextURL).then((html) => httpListPageData(html))
    }
  } catch (e) {
    console.error(e.message)
  }
}

// 写出数据
writeData = (data) => {
  var dataStr =
    Object.keys(data)
      .map((p) => data[p])
      .join(',') + '\n'
  fs.appendFile('data.csv', dataStr, (err) => {
    if (err) throw err
  })
}

// 爬取详细页面数据
httpDetailPageData = (html, url) => {
  const $ = cheerio.load(html)
  const productName = $('.ProductTitle__text').text()

  const cnumber = $('.Count__number')[0].childNodes[0].data

  const priceNowText = $('.Price__value')
    .text()
    .replace('\n', '')
    .replace('\n', '')
  const priceNowIdx = priceNowText.indexOf('円')
  const priceNow = priceNowText.substring(0, priceNowIdx).replace(',', '')

  const priceStart = 0
  const descpTitles = $('.ProductDetail__item .ProductDetail__title')
  descpTitles.each((i, el) => {
    if (el.childNodes[0].data === '開始価格') {
      try {
        const startPriceText = el.parentNode.children[3].children[1].data
        const startPriceIdx = startPriceText.indexOf('円')
        priceStart = startPriceText
          .substring(0, startPriceIdx)
          .replace(',', '')
          .trim()
      } catch (e) {
      }
  }
  })

  const sendPrice = $('.Price__postageValue').text()
  let category = []
  let status = ''
  const categoryTargets = $('.ProductTable__item a')
  categoryTargets.each((i, el) => {
    if (categoryTargets.length - 1 === i) {
      status = el.childNodes[0].data.replace('\n', '').replace('\n', '').trim()
    } else {
      category.push(el.childNodes[0].data.replace('\n', '').replace('\n', ''))
    }
  })
  while (category.length < 7) {
    category.push('')
  }

  // TODO 说明説明 寸法・発送サイズ 状態詳細 由于商品不同格式不同, 所以未抓取
  //const produce = $('.ProductExplanation__commentArea table').text()
  const obj = {
    productName,
    cnumber,
    priceNow,
    priceStart,
    //sendPrice,
    category,
    status,
    url,
  }

  return obj
}
