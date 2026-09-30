const prisma = require('../config/prismaClient');

// 1. GET /api/subscriptions
exports.getSubscriptions = async (req, res) => {
  try {
    const userId = req.user.id;

    const subs = await prisma.subscription.findMany({
      where: { userId },
      orderBy: { nextRenewal: 'asc' },
    });
    res.json(subs);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving subscriptions', error: error.message });
  }
};

// 2. POST /api/subscriptions
exports.addSubscription = async (req, res) => {
  try {
    const { name, category, cost, billingCycle, nextRenewal, paymentMethod, status, notifyBefore } = req.body;
    const userId = req.user.id;

    if (!name || !cost) {
      return res.status(400).json({ message: 'Service name and cost are required' });
    }

    const newSub = await prisma.subscription.create({
      data: {
        userId,
        name,
        category: category || 'Entertainment',
        cost: parseFloat(cost),
        billingCycle: billingCycle || 'monthly',
        nextRenewal: nextRenewal ? new Date(nextRenewal) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentMethod: paymentMethod || 'UPI',
        status: status || 'Active',
        confidence: 100, // manual entry holds 100% confidence
        notifyBefore: notifyBefore !== undefined ? notifyBefore : true,
      },
    });

    res.status(201).json(newSub);
  } catch (error) {
    res.status(500).json({ message: 'Error creating subscription', error: error.message });
  }
};

// 3. PUT /api/subscriptions/:id
exports.updateSubscription = async (req, res) => {
  try {
    const subId = req.params.id;
    const userId = req.user.id;

    const existing = await prisma.subscription.findFirst({
      where: { id: subId, userId },
    });
    if (!existing) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    const { name, category, cost, billingCycle, nextRenewal, paymentMethod, status, notifyBefore } = req.body;

    const updated = await prisma.subscription.update({
      where: { id: subId },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(cost !== undefined && { cost: parseFloat(cost) }),
        ...(billingCycle !== undefined && { billingCycle }),
        ...(nextRenewal !== undefined && { nextRenewal: new Date(nextRenewal) }),
        ...(paymentMethod !== undefined && { paymentMethod }),
        ...(status !== undefined && { status }),
        ...(notifyBefore !== undefined && { notifyBefore }),
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating subscription', error: error.message });
  }
};

// 4. DELETE /api/subscriptions/:id
exports.deleteSubscription = async (req, res) => {
  try {
    const subId = req.params.id;
    const userId = req.user.id;

    const existing = await prisma.subscription.findFirst({
      where: { id: subId, userId },
    });
    if (!existing) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    await prisma.subscription.delete({ where: { id: subId } });
    res.json({ message: 'Subscription deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting subscription', error: error.message });
  }
};