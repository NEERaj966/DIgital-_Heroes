let razorpayScriptPromise

export const loadRazorpayCheckout = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay checkout is only available in the browser'))
  }

  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay)
  }

  if (razorpayScriptPromise) {
    return razorpayScriptPromise
  }

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-razorpay-checkout="true"]')

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.Razorpay))
      existingScript.addEventListener('error', () =>
        reject(new Error('Unable to load Razorpay checkout'))
      )
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.dataset.razorpayCheckout = 'true'
    script.onload = () => resolve(window.Razorpay)
    script.onerror = () => reject(new Error('Unable to load Razorpay checkout'))
    document.body.appendChild(script)
  })

  return razorpayScriptPromise
}
