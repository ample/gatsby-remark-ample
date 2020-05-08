const deepForEach = require("deep-for-each")
const lodash = require("lodash")
const path = require("path")

const getKeyType = require("./utils/get-key-type")
const getOptions = require("./utils/get-options")
const getPermalink = require("./utils/get-permalink")
const processImage = require("./utils/process-image")
const processMarkdown = require("./utils/process-markdown")

// TODO: Copy relevant frontmatter into top-level key
// TODO: Add slug fields
// TODO: Explicitly set type from schema config
// TODO: Use schema for processing and remove suffix
// TODO: Update options
// TODO: Fix tests
// TODO: Update documentation

exports.onCreateNode = ({ node, actions, createNodeId, getNode, createContentDigest }, options) => {
  // Only process nodes that were created by gatsby-transformer-remark.
  if (lodash.get(node, "internal.type") !== "MarkdownRemark") return

  // Combine options passed into the plugin with the sensible defaults for a
  // comprehensive object of options.
  const args = getOptions(options)

  // Reference we use to know whether or not to create a child SEO node.
  let seoData

  // Loop through each key-value pair in the frontmatter.
  deepForEach(node.frontmatter, (value, key, subject, keyPath) => {
    // Get type of the node. Most will be "default" and are simply passed
    // through to the new node. Others get processed more specifically to their
    // type.
    const keyType = getKeyType({ keyPath: keyPath, options: args, value: value })
    switch (keyType) {
      // SEO keys simply set the seoData variable and are processed after the
      // new node is created.
      case "seo":
        seoData = value
        break
      // Markdown keys are converted to HTML and stored as a new key without the
      // suffix.
      case "md": {
        const newKeyPath = lodash.trimEnd(keyPath, args.markdownSuffix)
        const newValue = processMarkdown(value)
        if (newValue) lodash.set(node, `frontmatter.${newKeyPath}`, newValue)
        break
      }
      // Image keys are converted to a relative path from the markdown file to
      // the image, and stored as a new key without the suffix.
      case "img": {
        const newKeyPath = lodash.trimEnd(keyPath, args.imageSuffix)
        const newValue = processImage({
          absoluteFilePath: node.fileAbsolutePath,
          imageSrcDir: args.imageSrc,
          value: value
        })
        if (newValue) lodash.set(node, `frontmatter.${newKeyPath}`, newValue)
        break
      }
    }
    // If the key has a type (some keys are ignored), then we pass it through to
    // the new node.
    if (keyType) lodash.set(node, `frontmatter.${keyPath}`, value)
  })

  // Process an SEO node if the new node has SEO data attached to it.
  if (seoData) {
    const seoNode = {
      id: createNodeId(`${node.id} - SEO`),
      children: [],
      // The parent is the new node we just created.
      parent: node.id,
      internal: {
        contentDigest: createContentDigest(seoData),
        type: `SeoMeta`
      },
      // SEO data is nested under a "data" object to avoid naming conflicts.
      data: seoData
    }

    // Create SEO node and also create the parent-child relationship between the
    // new node and the SEO node.
    actions.createNode(seoNode)
    actions.createParentChildLink({ parent: node, child: seoNode })
  }

  return node
}
