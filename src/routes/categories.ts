import { Router } from 'express';
import { parsePositiveInt } from '../helpers.js';
import { flashErrors, flashSuccess, render404, requireAuth, requireRole } from '../middleware.js';
import { allocateCategoryId, categories, findCategoryByName, tickets } from '../store.js';

const router = Router();

router.get('/categories', requireAuth, requireRole('admin'), (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
  const statusFilter = typeof req.query.status === 'string' ? req.query.status : '';

  const ticketList = Array.from(tickets.values());
  const list = Array.from(categories.values())
    .filter((cat) => {
      if (statusFilter === 'active' && !cat.isActive) return false;
      if (statusFilter === 'inactive' && cat.isActive) return false;
      if (search) {
        const matches =
          cat.name.toLowerCase().includes(search) ||
          (cat.description || '').toLowerCase().includes(search);
        if (!matches) return false;
      }
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((cat) => ({
      ...cat,
      ticketsCount: ticketList.filter((t) => t.categoryId === cat.id).length,
    }));

  res.render('categories/index', {
    title: 'Categories',
    breadcrumbs: [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Categories' }],
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

  flashSuccess(req, `Category "${name}" created.`);
  res.redirect('/categories');
});

router.put('/categories/:id', requireAuth, requireRole('admin'), (req, res) => {
  const id = parsePositiveInt(req.params.id);
  const category = id ? categories.get(id) : undefined;
  if (!category) {
    render404(res, 'Category not found.');
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
  } else if (findCategoryByName(name, id!)) {
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

  flashSuccess(req, `Category "${name}" updated.`);
  res.redirect('/categories');
});

router.patch('/categories/:id/toggle-status', requireAuth, requireRole('admin'), (req, res) => {
  const id = parsePositiveInt(req.params.id);
  const category = id ? categories.get(id) : undefined;
  if (!category) {
    render404(res, 'Category not found.');
    return;
  }

  category.isActive = !category.isActive;
  category.updatedAt = new Date();
  flashSuccess(
    req,
    `Category "${category.name}" ${category.isActive ? 'activated' : 'deactivated'}.`
  );
  res.redirect('/categories');
});

router.delete('/categories/:id', requireAuth, requireRole('admin'), (req, res) => {
  const id = parsePositiveInt(req.params.id);
  const category = id ? categories.get(id) : undefined;
  if (!category) {
    render404(res, 'Category not found.');
    return;
  }

  const inUse = Array.from(tickets.values()).some((t) => t.categoryId === id);
  if (inUse) {
    flashErrors(req, ['This category is used by existing tickets. Deactivate it instead.']);
    res.redirect('/categories');
    return;
  }

  categories.delete(id!);
  flashSuccess(req, `Category "${category.name}" deleted.`);
  res.redirect('/categories');
});

export default router;
