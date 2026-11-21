import { Router } from 'express';
import { flashErrors, flashSuccess, requireAuth, requireRole } from '../middleware.js';
import { allocateCategoryId, categories, findCategoryByName, tickets } from '../store.js';

const router = Router();

router.get('/categories', requireAuth, requireRole('admin'), (_req, res) => {
  const ticketList = Array.from(tickets.values());
  const list = Array.from(categories.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((cat) => ({
      ...cat,
      ticketsCount: ticketList.filter((t) => t.categoryId === cat.id).length,
    }));

  res.render('categories/index', {
    title: 'Categories',
    categories: list,
  });
});

router.post('/categories', requireAuth, requireRole('admin'), (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const description =
    typeof req.body.description === 'string' ? req.body.description.trim() : '';

  const errors: string[] = [];
  if (!name) {
    errors.push('The name field is required.');
  } else if (name.length > 80) {
    errors.push('The name field must not be greater than 80 characters.');
  } else if (findCategoryByName(name)) {
    errors.push('The name has already been taken.');
  }
  if (description.length > 255) {
    errors.push('The description field must not be greater than 255 characters.');
  }

  if (errors.length > 0) {
    flashErrors(req, errors, { name, description });
    res.redirect('/categories');
    return;
  }

  const now = new Date();
  const id = allocateCategoryId();
  categories.set(id, {
    id,
    name,
    description: description || null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  flashSuccess(req, 'Category created.');
  res.redirect('/categories');
});

router.put('/categories/:id', requireAuth, requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const category = categories.get(id);
  if (!category) {
    res.status(404).send('Category not found.');
    return;
  }

  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const description =
    typeof req.body.description === 'string' ? req.body.description.trim() : '';
  const rawActive = req.body.is_active;
  const isActive = Array.isArray(rawActive)
    ? rawActive.includes('1') || rawActive.includes('true')
    : rawActive === '1' || rawActive === 'true' || rawActive === true;

  const errors: string[] = [];
  if (!name) {
    errors.push('The name field is required.');
  } else if (name.length > 80) {
    errors.push('The name field must not be greater than 80 characters.');
  } else if (findCategoryByName(name, id)) {
    errors.push('The name has already been taken.');
  }
  if (description.length > 255) {
    errors.push('The description field must not be greater than 255 characters.');
  }

  if (errors.length > 0) {
    flashErrors(req, errors);
    res.redirect('/categories');
    return;
  }

  category.name = name;
  category.description = description || null;
  category.isActive = isActive;
  category.updatedAt = new Date();

  flashSuccess(req, 'Category updated.');
  res.redirect('/categories');
});

router.delete('/categories/:id', requireAuth, requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const category = categories.get(id);
  if (!category) {
    res.status(404).send('Category not found.');
    return;
  }

  const inUse = Array.from(tickets.values()).some((t) => t.categoryId === id);
  if (inUse) {
    res.status(422).send('This category is used by tickets. Deactivate it instead.');
    return;
  }

  categories.delete(id);
  flashSuccess(req, 'Category deleted.');
  res.redirect('/categories');
});

export default router;
