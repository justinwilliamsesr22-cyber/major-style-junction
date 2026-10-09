fetch('https://us3.api.mailchimp.com/3.0/', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.msj_mailchimp_key}`,
    'Content-Type': 'application/json'
  }
})