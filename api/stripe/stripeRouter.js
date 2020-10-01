const express = require('express');
const router = express.Router();
const Parents = require('../parent/parentModel');
const checkToken = require('../middleware/jwtRestricted');

const stripe = require('stripe')(process.env.STRIPE_API_KEY);

router.get('/', (req, res) => {
  res.send('Stripe API Working');
});

router.post('/create-customer', checkToken, async (req, res) => {
  // Create a new customer object
  const customer = await stripe.customers.create({
    email: req.body.email,
  });
  Parents.findBy({ email: req.body.email })
    .first()
    .then((parent) => {
      if (parent) {
        parent.stripeCustomerId = customerId;
        Parents.update(parent.id, parent)
        .then(resp => {
          res.status(200).json(resp)
        })
        .catch(err => {
          res.status(500).json(err)
        })
      } else {
        res.status(400).json({ message: 'parent not found' });
      }
    });

  res.send({ customer });
});

router.post('/create-subscription', checkToken, async (req, res) => {
  // Attach the payment method to the customer
  try {
    await stripe.paymentMethods.attach(req.body.paymentMethodId, {
      customer: req.body.customerId,
    });
  } catch (error) {
    return res.status('402').send({ error: { message: error.message } });
  }

  // Change the default invoice settings on the customer to the new payment method
  await stripe.customers.update(req.body.customerId, {
    invoice_settings: {
      default_payment_method: req.body.paymentMethodId,
    },
  });

  // Create the subscription
  const subscription = await stripe.subscriptions.create({
    customer: req.body.customerId,
    items: [{ price: 'price_HGd7M3DV3IMXkC' }],
    expand: ['latest_invoice.payment_intent'],
  });

  res.send(subscription);
});

router.post('/retry-invoice', async (req, res) => {
  // Set the default payment method on the customer

  try {
    await stripe.paymentMethods.attach(req.body.paymentMethodId, {
      customer: req.body.customerId,
    });
    await stripe.customers.update(req.body.customerId, {
      invoice_settings: {
        default_payment_method: req.body.paymentMethodId,
      },
    });
  } catch (error) {
    // in case card_decline error
    return res
      .status('402')
      .send({ result: { error: { message: error.message } } });
  }

  const invoice = await stripe.invoices.retrieve(req.body.invoiceId, {
    expand: ['payment_intent'],
  });
  res.send(invoice);
});

router.post('/cancel-subscription', async (req, res) => {
  // Delete the subscription
  const deletedSubscription = await stripe.subscriptions.del(
    req.body.subscriptionId
  );
  res.send(deletedSubscription);
});

router.post('/update-subscription', checkToken, async (req, res) => {
  const subscription = await stripe.subscriptions.retrieve(
    req.body.subscriptionId
  );
  const updatedSubscription = await stripe.subscriptions.update(
    req.body.subscriptionId,
    {
      cancel_at_period_end: false,
      items: [
        {
          id: subscription.items.data[0].id,
          price: 'price_H1NlVtpo6ubk0m',
        },
      ],
    }
  );

  res.send(updatedSubscription);
});

module.exports = router;