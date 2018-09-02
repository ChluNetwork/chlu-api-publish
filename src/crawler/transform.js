const { map, get } = require('lodash')

function transformYelpData(yelpData) {
  console.log('transform Yelp data')
  console.log(yelpData)

  return map(yelpData, (review) => {
    return {
      subject: {
        name: review.name,
        address: review.address,
        telephone: null,
        categories: review.types,
        location: {
          lat: review.latitude,
          lng: review.longitude
        },
        url: review.webpage,
      },
      platform: {
        name: 'yelp',
        url: 'yelp.com',
        subject_url: review.url
      },
      author: {
        name: review.author,
      },
      review: {
        date_published: review.datePublished,
        url: review.rev_url,
        title: null,
        text: review.description
      },
      rating: {
        min: 1,
        value: review.ratingValue,
        max: 5,
      },
      verifiable: false,
      proof: null
    }
  })
}

function transformTripAdvisorData(tripAdvisorData) {
  console.log('transform TripAdvisor data')
  console.log(tripAdvisorData)

  return map(tripAdvisorData, (review) => {
    return {
      subject: {
        name: review.name,
        address: `${review.street}, ${review.city} ${review.postal}, ${review.country}`,
        telephone: review.telephone,
        categories: [review.type, review.subtype],
        location: null,
        url: review.url,
        platform_url: review.restaurant_url,
      },
      platform: {
        name: 'TripAdvisor',
        url: 'tripadvisor.com',
        subject_url: review.url
      },
      author: {
        name: review.author,
      },
      review: {
        date_published: review.date,
        url: review.rev_url,
        title: review.title,
        text: review.text
      },
      rating: {
        min: 1,
        value: review.score,
        max: 5,
      }
    }
  })
}

function transformUpworkData(upworkData) {
  console.log('transform upwork data')
  console.log(upworkData)
  const results = map(upworkData, (review) => {
    const scoreDetails = get(review, 'feedback.scoreDetails', [])
    const detailed_review = map(scoreDetails, detail => {
      return {
        rating: {
          min: 0,
          value: detail.score,
          max: 5,
        },
        review_text: detail.description,
        category: detail.label,
        attribute: ''
      }
    })
    return {
      subject: {
        name: review.agencyName || '', // TODO: for freelancers name stays null
        categories: review.skills || [],
      },
      platform: {
        name: 'Upwork',
        url: 'upwork.com',
      },
      author: {
        name: String(review.clientId),
      },
      review: {
        text: get(review, 'feedback.comment', null),
      },
      rating_details: {
        min: 1,
        value: get(review, 'feedback.score', null),
        max: 5,
      },
      detailed_review
    }
  })
  console.log(results)
  return results
}

function transformNewApifyData(data, profileUrl) {
  const results = map(data, (review) => {
    const detailed_review = map(get(review, 'detailed_review', []), detail => {
      return {
        rating: {
          min: 0,
          value: get(detail, 'rating.value', null),
          max: 5
        },
        // review_text: detail.description,
        category: get(detail, 'category', null),
        attribute: ''
      }
    })

    return {
      subject: {
        name: get(review, 'subject.name', ''),
        categories: get(review, 'subject.categories', [])
      },
      platform: {
        name: 'upwork',
        url: 'upwork.com',
        subject_url: get(review, 'platform.subject_url', profileUrl)
      },
      author: {
        name: get(review, 'author.name', null)
      },
      review: {
        text: get(review, 'review.text', ''),
        title: get(review, 'review.title', '')
      },
      rating_details: {
        min: 1,
        value: get(review, 'rating.value', null),
        max: 5,
      },
      detailed_review
    }
  })

  return results
}

module.exports = {
  transformYelpData,
  transformTripAdvisorData,
  transformUpworkData,
  transformNewApifyData
}
